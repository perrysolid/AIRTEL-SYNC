import fs from "node:fs";
import path from "node:path";
import { scoreLead, type Score } from "./analytics";
import { hashPassword, type Role } from "./auth";
import { datasets, type LeadRow } from "./data";
import { dbEnabled, pool } from "./db";
import { store } from "./store";
import { botLinks, winbackMessage } from "./winback";

/**
 * The sales portal's records: staff accounts, who owns which lead, and every
 * touch on a lead (calls, WhatsApp links, notes, status changes). Neon
 * Postgres when DATABASE_URL is set, a JSON file next to the store otherwise.
 */

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: Role;
  region?: Region;
  partnerCode?: string;
  passwordHash: string;
}

export type Region = "North" | "West" | "South" | "East";
export type ActivityKind = "call" | "whatsapp" | "note" | "status" | "assign";
export interface Activity {
  id: number;
  leadId: string;
  staffId: string;
  at: string;
  kind: ActivityKind;
  outcome?: string;
  status?: LeadStatus;
  note: string;
  nextAt?: string;
}

export const STATUSES = {
  to_call: "To call",
  contacted: "Contacted",
  interested: "Interested",
  quote_sent: "Quote sent",
  won: "Won",
  lost: "Lost",
  dnc: "Do not call",
  customer: "Customer",
} as const;
export type LeadStatus = keyof typeof STATUSES;
export const OPEN_STATUSES: LeadStatus[] = ["to_call", "contacted", "interested", "quote_sent"];

export const CALL_OUTCOMES = ["Connected", "No answer", "Busy, call back", "Wrong number", "Not interested"] as const;

const REGION_OF_STATE: Record<string, Region> = {
  Delhi: "North", Punjab: "North", "Uttar Pradesh": "North", Rajasthan: "North", Haryana: "North",
  Maharashtra: "West", Gujarat: "West", "Madhya Pradesh": "West", Goa: "West",
  Karnataka: "South", "Tamil Nadu": "South", Telangana: "South", Kerala: "South", "Andhra Pradesh": "South",
  "West Bengal": "East", Bihar: "East", Odisha: "East", Jharkhand: "East", Assam: "East",
};
export const regionOf = (state: string): Region => REGION_OF_STATE[state] ?? "West";

/** Demo team. Password comes from STAFF_DEMO_PASSWORD (see README); change it before real use. */
const DEMO_STAFF: Omit<Staff, "passwordHash">[] = [
  { id: "st_manager", email: "manager@accel.demo", name: "Kavita Rao", role: "admin" },
  { id: "st_priya", email: "priya@accel.demo", name: "Priya Malhotra", role: "sales", region: "North" },
  { id: "st_rahul", email: "rahul@accel.demo", name: "Rahul Deshmukh", role: "sales", region: "West" },
  { id: "st_arjun", email: "arjun@accel.demo", name: "Arjun Nair", role: "sales", region: "South" },
  { id: "st_ananya", email: "ananya@accel.demo", name: "Ananya Sen", role: "sales", region: "East" },
  { id: "pt_metro", email: "metro@partner.demo", name: "Metro Mobiles (Delhi)", role: "partner", region: "North", partnerCode: "PTN-METRO" },
  { id: "pt_shree", email: "shree@partner.demo", name: "Shree Telecom (Pune)", role: "partner", region: "West", partnerCode: "PTN-SHREE" },
  { id: "pt_sai", email: "sai@partner.demo", name: "Sai Digital (Chennai)", role: "partner", region: "South", partnerCode: "PTN-SAI" },
  { id: "pt_eastern", email: "eastern@partner.demo", name: "Eastern Connect (Kolkata)", role: "partner", region: "East", partnerCode: "PTN-EAST" },
];
export const demoPassword = () => process.env.STAFF_DEMO_PASSWORD || "Accel@2026";

interface Crm {
  staff: Staff[];
  activity: Activity[];
}
const FILE = path.join(process.env.STORE_DIR || path.join(process.cwd(), ".data"), "crm.json");
const g = globalThis as unknown as { __accelCrm?: Promise<Crm> };

/**
 * Two weeks of sample call history so a fresh demo has something on its
 * charts. Deterministic (seeded), marked "Sample activity" in the note.
 */
function sampleActivity(now = new Date()): Omit<Activity, "id">[] {
  let seed = 20260715;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const book = [...leadBook().values()].filter((l) => l.defaultStatus === "to_call").sort((a, b) => b.score.probability - a.score.probability);
  const byOwner = new Map<string, LeadBase[]>();
  for (const l of book) byOwner.set(l.defaultOwner, [...(byOwner.get(l.defaultOwner) ?? []), l]);
  const out: Omit<Activity, "id">[] = [];
  for (let d = 13; d >= 0; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    if (day.getDay() === 0) continue;
    for (const [owner, leads] of byOwner) {
      const n = Math.round((owner.startsWith("pt_") ? 3 : 7) * (0.6 + rnd() * 0.8));
      for (let k = 0; k < n; k++) {
        const lead = leads.shift();
        if (!lead) break;
        const r = rnd();
        const outcome = r < 0.42 ? "Connected" : r < 0.7 ? "No answer" : r < 0.82 ? "Busy, call back" : r < 0.88 ? "Wrong number" : "Not interested";
        const won = outcome === "Connected" && rnd() < 0.18 + lead.score.probability;
        const status: LeadStatus = won ? (rnd() < 0.4 ? "won" : "quote_sent") : outcome === "Connected" ? (rnd() < 0.5 ? "interested" : "contacted") : outcome === "Not interested" ? "lost" : outcome === "Wrong number" ? "dnc" : "contacted";
        const at = new Date(day.getTime() + (10 + rnd() * 8) * 3_600_000);
        if (at > now) continue;
        // Promised call-backs land between yesterday and five days out, so "due today" is a realistic handful.
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const follow = OPEN_STATUSES.includes(status) && rnd() < 0.55 ? new Date(today.getTime() + (Math.floor(rnd() * 7) - 1) * 86_400_000 + (10 + Math.floor(rnd() * 8)) * 3_600_000).toISOString() : undefined;
        out.push({ leadId: lead.id, staffId: owner, at: at.toISOString(), kind: "call", outcome, status, note: "Sample activity", nextAt: follow });
      }
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function seedStaff(): Staff[] {
  const pw = demoPassword();
  return DEMO_STAFF.map((s) => ({ ...s, passwordHash: hashPassword(pw) }));
}

async function loadCrm(): Promise<Crm> {
  if (dbEnabled()) {
    const db = pool();
    let { rows: staff } = await db.query("SELECT id, email, name, role, region, partner_code, password_hash FROM staff ORDER BY created_at, id");
    if (!staff.length) {
      const seed = seedStaff();
      await db.query(
        `INSERT INTO staff (id, email, name, role, region, partner_code, password_hash)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) ON CONFLICT DO NOTHING`,
        [seed.map((s) => s.id), seed.map((s) => s.email), seed.map((s) => s.name), seed.map((s) => s.role), seed.map((s) => s.region ?? null), seed.map((s) => s.partnerCode ?? null), seed.map((s) => s.passwordHash)],
      );
      ({ rows: staff } = await db.query("SELECT id, email, name, role, region, partner_code, password_hash FROM staff ORDER BY created_at, id"));
      const sample = sampleActivity();
      await db.query(
        `INSERT INTO lead_activity (lead_id, staff_id, at, kind, outcome, status, note, next_at)
         SELECT * FROM unnest($1::text[], $2::text[], $3::timestamptz[], $4::text[], $5::text[], $6::text[], $7::text[], $8::timestamptz[])`,
        [sample.map((a) => a.leadId), sample.map((a) => a.staffId), sample.map((a) => a.at), sample.map((a) => a.kind), sample.map((a) => a.outcome ?? null), sample.map((a) => a.status ?? null), sample.map((a) => a.note), sample.map((a) => a.nextAt ?? null)],
      );
    }
    const { rows: act } = await db.query("SELECT id, lead_id, staff_id, at, kind, outcome, status, note, next_at FROM lead_activity ORDER BY id");
    return {
      staff: staff.map((r) => ({ id: r.id, email: r.email, name: r.name, role: r.role, region: r.region ?? undefined, partnerCode: r.partner_code ?? undefined, passwordHash: r.password_hash })),
      activity: act.map((r) => ({
        id: Number(r.id), leadId: r.lead_id, staffId: r.staff_id, at: new Date(r.at).toISOString(), kind: r.kind,
        outcome: r.outcome ?? undefined, status: r.status ?? undefined, note: r.note, nextAt: r.next_at ? new Date(r.next_at).toISOString() : undefined,
      })),
    };
  }
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Crm;
  } catch {
    const crm: Crm = { staff: seedStaff(), activity: sampleActivity().map((a, i) => ({ ...a, id: i + 1 })) };
    saveFile(crm);
    return crm;
  }
}

function saveFile(crm: Crm) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(crm));
  } catch (e) {
    console.warn("[crm] could not write", e);
  }
}

function crm(): Promise<Crm> {
  g.__accelCrm ??= loadCrm().catch((e) => {
    g.__accelCrm = undefined;
    throw e;
  });
  return g.__accelCrm;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function staffByEmail(email: string) {
  return (await crm()).staff.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
}
export async function staffById(id: string) {
  return (await crm()).staff.find((s) => s.id === id);
}
export async function listStaff() {
  return (await crm()).staff.map((s) => ({ id: s.id, email: s.email, name: s.name, role: s.role, region: s.region, partnerCode: s.partnerCode }));
}

// ---------------------------------------------------------------------------
// Lead book
// ---------------------------------------------------------------------------

const RECOVERABLE = /no time|not scheduled|took too long|too complex|decided to wait|paperwork|signatory|missing|unreachable|slow|complex|price/i;

export interface LeadBase {
  id: string;
  row: LeadRow;
  region: Region;
  score: Score;
  defaultOwner: string;
  defaultStatus: LeadStatus;
}

let base: Map<string, LeadBase> | undefined;
/** Scored once per process: 5,000 leads take ~30 ms. */
export function leadBook(): Map<string, LeadBase> {
  if (base) return base;
  base = new Map();
  for (const row of datasets().leads) {
    const region = regionOf(row.state);
    const owner = DEMO_STAFF.find((s) => s.region === region && s.role === (row.lead_source === "Channel partner" ? "partner" : "sales"))!.id;
    const status: LeadStatus = row.outcome === "Activated" ? "customer" : RECOVERABLE.test(row.drop_reason) ? "to_call" : "lost";
    base.set(row.lead_id, { id: row.lead_id, row, region, score: scoreLead(row), defaultOwner: owner, defaultStatus: status });
  }
  return base;
}

export interface LeadView extends LeadBase {
  owner: string;
  status: LeadStatus;
  lastTouch?: Activity;
  nextAt?: string;
  touches: number;
}

/** Folds the activity log over the base book: current owner, status, next follow-up. */
export async function leadViews(): Promise<Map<string, LeadView>> {
  const { activity } = await crm();
  const out = new Map<string, LeadView>();
  for (const b of leadBook().values()) out.set(b.id, { ...b, owner: b.defaultOwner, status: b.defaultStatus, touches: 0 });
  for (const a of activity) {
    const v = out.get(a.leadId);
    if (!v) continue;
    if (a.kind === "assign" && a.note) v.owner = a.note;
    if (a.status) v.status = a.status;
    if (a.kind !== "assign") {
      v.touches++;
      v.lastTouch = a;
      v.nextAt = a.nextAt;
    }
  }
  return out;
}

export function canSee(staff: Pick<Staff, "id" | "role">, lead: LeadView) {
  return staff.role === "admin" || lead.owner === staff.id;
}

export async function visibleLeads(staff: Pick<Staff, "id" | "role">) {
  return [...(await leadViews()).values()].filter((l) => canSee(staff, l));
}

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime();

/**
 * Who to call today: follow-ups that are due first (oldest first), then open
 * leads nobody has touched in two days, best chance to activate first.
 */
export async function callQueue(staff: Pick<Staff, "id" | "role">, now = new Date(), limit = 60) {
  const eod = endOfDay(now);
  const twoDays = now.getTime() - 2 * 86_400_000;
  const open = (await visibleLeads(staff)).filter((l) => OPEN_STATUSES.includes(l.status));
  const due = open.filter((l) => l.nextAt && new Date(l.nextAt).getTime() <= eod).sort((a, b) => a.nextAt!.localeCompare(b.nextAt!));
  const fresh = open
    .filter((l) => !l.nextAt && (!l.lastTouch || new Date(l.lastTouch.at).getTime() < twoDays))
    .sort((a, b) => b.score.probability - a.score.probability);
  return { due, fresh: fresh.slice(0, Math.max(0, limit - due.length)), openTotal: open.length };
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function activityFor(leadId: string) {
  return (await crm()).activity.filter((a) => a.leadId === leadId).reverse();
}

export async function activitySince(since: Date) {
  const t = since.toISOString();
  return (await crm()).activity.filter((a) => a.at >= t);
}

export async function logActivity(input: Omit<Activity, "id" | "at"> & { at?: string }): Promise<Activity> {
  const c = await crm();
  const a: Activity = { ...input, id: (c.activity.at(-1)?.id ?? 0) + 1, at: input.at ?? new Date().toISOString() };
  if (dbEnabled()) {
    const { rows } = await pool().query(
      "INSERT INTO lead_activity (lead_id, staff_id, at, kind, outcome, status, note, next_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [a.leadId, a.staffId, a.at, a.kind, a.outcome ?? null, a.status ?? null, a.note, a.nextAt ?? null],
    );
    a.id = Number(rows[0].id);
  }
  c.activity.push(a);
  if (!dbEnabled()) saveFile(c);
  store.audit(a.staffId, `lead.${a.kind}`, a.leadId, [a.outcome, a.status].filter(Boolean).join(" · "));
  return a;
}

/** The win-back message and links a salesperson sends from the lead record. */
export function outreachFor(lead: LeadRow) {
  const links = botLinks(lead.lead_id, `Hi Udyam, ${lead.business_name} here`);
  return { ...links, message: winbackMessage(lead, links.whatsapp) };
}

/** Test hook: forget the in-memory book so a test can start clean. */
export function resetCrmForTests() {
  g.__accelCrm = undefined;
}

/** The dataset has no phone numbers, so the demo shows a stable placeholder per lead. */
export function demoPhone(leadId: string) {
  const n = Number(leadId.slice(1));
  return `+91 9${String((n * 7919) % 1000).padStart(3, "0")}0 ${String((n * 104729) % 100000).padStart(5, "0")}`;
}
