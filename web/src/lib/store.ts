import type { GeminiContent } from "./gemini";
import type { GroqMessage } from "./groq";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "./profile";
import type { Recommendation } from "./recommend";
import type { Quote, Term } from "./pricing";
import type { KycResult } from "./kyc-types";
import type { Purpose } from "./privacy";
import type { OrderTimeline } from "./tracker";
import { dbEnabled, insertAudit, loadAudit, loadRecords, migrate, upsertRecords, type RecordKind } from "./db";

/**
 * In-memory store with durable write-through. With DATABASE_URL (Neon
 * Postgres) it is loaded once at boot (hydrateStore, from instrumentation) and
 * every change is flushed to Postgres; without it, a JSON file is used.
 * Reads stay synchronous and in-process: the backend is a single instance.
 */

export type Channel = "web" | "voice" | "whatsapp" | "telegram" | "partner";

/** Where a chat-bot conversation lives, so order updates reach the same chat. */
export interface BotChat {
  channel: "whatsapp" | "telegram";
  chatId: string;
}

export interface AdvisorSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  channel: Channel;
  language: string;
  profile: Profile;
  requestedProducts: string[];
  declinedProducts: string[];
  /** Full model transcripts (AI mode) — kept server-side only. */
  messages: Anthropic.Beta.BetaMessageParam[];
  geminiContents?: GeminiContent[];
  groqMessages?: GroqMessage[];
  /** Plain transcript for the UI and for partner hand-off summaries. */
  transcript: { role: "user" | "assistant"; text: string; at: string }[];
  recommendation?: Recommendation;
  quote?: Quote;
  /** Guided (no-AI) mode: which question we are on. */
  guidedStep?: string;
  status: "open" | "quoted" | "ordered" | "handoff";
  handoff?: { reason: string; at: string; summary: string; partner?: string };
  orderId?: string;
  /** SHA-256 of the WhatsApp sender, to continue a chat without storing the number. */
  contactHash?: string;
  /** Last single-choice options offered, so "2" works on WhatsApp and voice. */
  lastChips?: { label: string; value: string }[];
  lastChipsMode?: "single" | "multi";
  /** Telegram multi-select: options ticked so far. */
  multiPick?: string[];
  botChat?: BotChat;
  /** CRM lead this session resumed from (win-back link), e.g. L00042. */
  leadId?: string;
  /** Order whose owner referred this business (REF- link). */
  referredBy?: string;
  /** When the "your plan is saved" reminder went out (once per quote). */
  nudgedAt?: string;
  /** Owner tapped "Order" in chat but we still need their mobile number. */
  pendingOrder?: boolean;
}

export interface ConsentRecord {
  id: string;
  orderId: string;
  version: string;
  purposes: Record<Purpose, boolean>;
  givenAt: string;
  withdrawnAt?: string;
  /** Hash chain over the consent ledger for tamper evidence. */
  hash: string;
  prevHash: string;
}

export interface KycDocRecord {
  docType: string;
  sha256: string;
  engine: string;
  /** Minimal extracted fields only — no images are stored. */
  fields: Record<string, string | null | undefined>;
  legible: boolean;
  at: string;
}

export interface Order {
  id: string;
  sessionId?: string;
  createdAt: string;
  businessName: string;
  city?: string;
  contactName?: string;
  phone?: string;
  channel: Channel;
  partnerCode?: string;
  profile: Profile;
  lines: Quote["lines"];
  term: Term;
  quote: Quote;
  consentId?: string;
  kyc?: { result: KycResult; docs: KycDocRecord[]; at: string; registryLookups: { gstin?: string; udyam?: string } };
  esign?: { at: string; method: "aadhaar-otp-mock"; docHash: string };
  payment?: { at: string; method: string; amount: number; ref: string };
  timeline: OrderTimeline;
  notifications: { at: string; channel: "whatsapp" | "telegram" | "sms"; text: string }[];
  botChat?: BotChat;
  leadId?: string;
  referredBy?: string;
  /** Reminder sent per waiting step (kyc / esign / pay), so each goes out once. */
  nudges?: Record<string, string>;
}

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  ref: string;
  detail: string;
}

interface DB {
  sessions: Record<string, AdvisorSession>;
  orders: Record<string, Order>;
  consents: ConsentRecord[];
  audit: AuditEvent[];
}

// STORE_DIR points at a persistent disk in production (Render mounts one).
const FILE = path.join(process.env.STORE_DIR || path.join(process.cwd(), ".data"), "store.json");
const g = globalThis as unknown as { __udyamStore?: DB };

function load(): DB {
  if (!g.__udyamStore && !dbEnabled()) {
    try {
      g.__udyamStore = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
    } catch {
      g.__udyamStore = { sessions: {}, orders: {}, consents: [], audit: [] };
    }
  }
  // With Postgres, hydrateStore() fills this at boot; empty until then.
  g.__udyamStore ??= { sessions: {}, orders: {}, consents: [], audit: [] };
  return g.__udyamStore;
}

const dirty = new Map<string, { kind: RecordKind; id: string }>();
let auditQueue: AuditEvent[] = [];
let pending: NodeJS.Timeout | undefined;

function persist(kind?: RecordKind, id?: string) {
  if (kind && id) dirty.set(`${kind}:${id}`, { kind, id });
  if (pending) return;
  pending = setTimeout(() => {
    pending = undefined;
    void flush();
  }, 50);
}

/** Writes pending changes; exported so tests and shutdown can wait for it. */
export async function flush() {
  if (!dbEnabled()) {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(load()));
    } catch (e) {
      console.warn("[store] persist failed (read-only FS?)", e);
    }
    return;
  }
  const db = load();
  const rows = [...dirty.values()].map(({ kind, id }) => ({
    kind,
    id,
    data: kind === "session" ? db.sessions[id] : kind === "order" ? db.orders[id] : db.consents.find((c) => c.id === id),
  }));
  const audit = auditQueue;
  dirty.clear();
  auditQueue = [];
  try {
    await upsertRecords(rows.filter((r) => r.data));
    await insertAudit(audit);
  } catch (e) {
    // Keep them for the next flush rather than losing a write on a network blip.
    for (const r of rows) dirty.set(`${r.kind}:${r.id}`, r);
    auditQueue = [...audit, ...auditQueue];
    console.warn(`[store] Postgres write failed, will retry: ${(e as Error).message}`);
    setTimeout(() => persist(), 5_000);
  }
}

/** Loads the store from Postgres before the server takes requests. */
export async function hydrateStore() {
  if (!dbEnabled()) return;
  await migrate();
  const [records, audit] = await Promise.all([loadRecords(), loadAudit(2000)]);
  const db: DB = { sessions: {}, orders: {}, consents: [], audit };
  for (const r of records) {
    if (r.kind === "session") db.sessions[(r.data as AdvisorSession).id] = r.data as AdvisorSession;
    else if (r.kind === "order") db.orders[(r.data as Order).id] = r.data as Order;
    else db.consents.push(r.data as ConsentRecord);
  }
  g.__udyamStore = db;
  console.log(`[store] Neon Postgres: ${Object.keys(db.sessions).length} sessions, ${Object.keys(db.orders).length} orders, ${db.consents.length} consents`);
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
export const now = () => new Date().toISOString();

export const store = {
  getSession: (id: string) => load().sessions[id],
  saveSession(s: AdvisorSession) {
    s.updatedAt = now();
    load().sessions[s.id] = s;
    persist("session", s.id);
    return s;
  },
  listSessions: () => Object.values(load().sessions),

  getOrder: (id: string) => load().orders[id],
  saveOrder(o: Order) {
    load().orders[o.id] = o;
    persist("order", o.id);
    return o;
  },
  listOrders: () => Object.values(load().orders),

  addConsent(rec: Omit<ConsentRecord, "hash" | "prevHash">): ConsentRecord {
    const db = load();
    const prevHash = db.consents.at(-1)?.hash ?? "genesis";
    const hash = crypto.createHash("sha256").update(prevHash + JSON.stringify(rec)).digest("hex");
    const full = { ...rec, prevHash, hash };
    db.consents.push(full);
    persist("consent", full.id);
    return full;
  },
  getConsent: (id: string) => load().consents.find((c) => c.id === id),
  listConsents: () => load().consents,
  withdrawConsent(id: string, purpose: Purpose) {
    const c = load().consents.find((x) => x.id === id);
    if (!c) return undefined;
    c.purposes[purpose] = false;
    if (!Object.values(c.purposes).some(Boolean)) c.withdrawnAt = now();
    persist("consent", c.id);
    return c;
  },

  audit(actor: string, action: string, ref: string, detail = "") {
    const db = load();
    const ev = { at: now(), actor, action, ref, detail };
    db.audit.push(ev);
    if (db.audit.length > 2000) db.audit.splice(0, db.audit.length - 2000);
    auditQueue.push(ev);
    persist();
  },
  listAudit: () => load().audit,
};
