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

/**
 * Tiny JSON-file store. Good enough for a prototype and a live demo; the
 * interfaces map 1:1 onto Postgres tables (see docs/architecture.md).
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

  // ---- Added on nanki: install scheduling, service health, branches (all optional, so old stores still load) ----
  /** Pincode of the install address, set by the Network Reality Check. */
  pincode?: string;
  /** Owner-chosen installation slot. `day` is on the order's demo clock. */
  slot?: { id: string; label: string; date: string; window: string; day: number };
  reschedules?: number;
  outageActive?: boolean;
  incidents?: Incident[];
  tickets?: Ticket[];
  /** Branch-in-a-Box: the head-office order this one was cloned from, and the branches cloned from this one. */
  parentId?: string;
  branches?: { id: string; name: string; city: string }[];
  /** Documents still needed from the owner (e.g. the new branch's address proof). */
  pendingDocs?: string[];
}

export interface Ticket {
  id: string;
  kind: "outage" | "no_internet" | "slow_speed" | "billing" | "other";
  detail: string;
  stepsTried: string[];
  at: string;
  status: "Open" | "Resolved";
  slaHours: number;
  assignedTo: string;
}

export interface Incident {
  id: string;
  at: string;
  /** True when a backup link kept the business online. */
  failover: boolean;
  minutes: number;
  status: "Active" | "Resolved";
  ticketId?: string;
  switchSeconds?: number;
}

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  ref: string;
  detail: string;
}

/** Where a multi-step chat feature (slot picker, troubleshooter, branch) currently is for one chat. */
export interface BotFlow {
  kind: "shield" | "network" | "schedule" | "trouble" | "branch";
  orderId?: string;
  /** Option values offered last, so "2" works on transports without buttons. */
  opts?: string[];
  step?: string;
  data?: Record<string, string>;
}

interface DB {
  flows?: Record<string, BotFlow>;
  sessions: Record<string, AdvisorSession>;
  orders: Record<string, Order>;
  consents: ConsentRecord[];
  audit: AuditEvent[];
}

// STORE_DIR points at a persistent disk in production (Render mounts one).
const FILE = path.join(process.env.STORE_DIR || path.join(process.cwd(), ".data"), "store.json");
const g = globalThis as unknown as { __udyamStore?: DB };

function load(): DB {
  if (!g.__udyamStore) {
    try {
      g.__udyamStore = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
    } catch {
      g.__udyamStore = { sessions: {}, orders: {}, consents: [], audit: [] };
    }
  }
  return g.__udyamStore;
}

let pending: NodeJS.Timeout | undefined;
function persist() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = undefined;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(load()));
    } catch (e) {
      console.warn("[store] persist failed (read-only FS?)", e);
    }
  }, 50);
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
export const now = () => new Date().toISOString();

export const store = {
  getSession: (id: string) => load().sessions[id],
  saveSession(s: AdvisorSession) {
    s.updatedAt = now();
    load().sessions[s.id] = s;
    persist();
    return s;
  },
  listSessions: () => Object.values(load().sessions),

  getFlow: (key: string) => load().flows?.[key],
  saveFlow(key: string, f: BotFlow) {
    (load().flows ??= {})[key] = f;
    persist();
  },
  clearFlow(key: string) {
    if (load().flows?.[key]) {
      delete load().flows![key];
      persist();
    }
  },

  getOrder: (id: string) => load().orders[id],
  saveOrder(o: Order) {
    load().orders[o.id] = o;
    persist();
    return o;
  },
  listOrders: () => Object.values(load().orders),

  addConsent(rec: Omit<ConsentRecord, "hash" | "prevHash">): ConsentRecord {
    const db = load();
    const prevHash = db.consents.at(-1)?.hash ?? "genesis";
    const hash = crypto.createHash("sha256").update(prevHash + JSON.stringify(rec)).digest("hex");
    const full = { ...rec, prevHash, hash };
    db.consents.push(full);
    persist();
    return full;
  },
  getConsent: (id: string) => load().consents.find((c) => c.id === id),
  listConsents: () => load().consents,
  withdrawConsent(id: string, purpose: Purpose) {
    const c = load().consents.find((x) => x.id === id);
    if (!c) return undefined;
    c.purposes[purpose] = false;
    if (!Object.values(c.purposes).some(Boolean)) c.withdrawnAt = now();
    persist();
    return c;
  },

  audit(actor: string, action: string, ref: string, detail = "") {
    const db = load();
    db.audit.push({ at: now(), actor, action, ref, detail });
    if (db.audit.length > 2000) db.audit.splice(0, db.audit.length - 2000);
    persist();
  },
  listAudit: () => load().audit,
};
