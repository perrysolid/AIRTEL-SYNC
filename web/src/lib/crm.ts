import fs from "node:fs";
import path from "node:path";
import { scoreLead, type Score } from "./analytics";
import { hashPassword, type Role } from "./auth";
import { datasets, type LeadRow } from "./data";
import { langName } from "./advisor-types";
import type { Profile } from "./profile";
import { allLive } from "./tracker";
import { dbEnabled, pool } from "./db";
import { store, type AdvisorSession, type Order } from "./store";
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
export type ActivityKind = "call" | "whatsapp" | "note" | "status" | "assign" | "report";
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

/**
 * The team: an area salesman who works the leads and installations, a supervisor who also calls, moves leads and
 * sends the day's report, and the manager who reads it. Password from STAFF_DEMO_PASSWORD (see README).
 */
const DEMO_STAFF: Omit<Staff, "passwordHash">[] = [
  { id: "st_manager", email: "manager@accel.demo", name: "Kavita Rao", role: "admin" },
  { id: "st_supervisor", email: "supervisor@accel.demo", name: "Priya Malhotra", role: "supervisor" },
  { id: "st_salesman", email: "salesman@accel.demo", name: "Rahul Deshmukh", role: "sales", region: "West" },
];
/** New registrations land with the area salesman. */
export const AREA_SALESMAN = "st_salesman";
export const demoPassword = () => process.env.STAFF_DEMO_PASSWORD || "Accel@2026";

interface Crm {
  staff: Staff[];
  activity: Activity[];
}
const FILE = path.join(process.env.STORE_DIR || path.join(process.cwd(), ".data"), "crm.json");
const g = globalThis as unknown as { __accelCrm?: Promise<Crm> };

function seedStaff(): Staff[] {
  const pw = demoPassword();
  return DEMO_STAFF.map((s) => ({ ...s, passwordHash: hashPassword(pw) }));
}

async function loadCrm(): Promise<Crm> {
  if (dbEnabled()) {
    const db = pool();
    // Bring an older database up to date: the supervisor role and reports, no sample calls, only today's team.
    await db.query(`
      ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
      ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'supervisor', 'sales', 'partner'));
      ALTER TABLE lead_activity DROP CONSTRAINT IF EXISTS lead_activity_kind_check;
      ALTER TABLE lead_activity ADD CONSTRAINT lead_activity_kind_check CHECK (kind IN ('call', 'whatsapp', 'note', 'status', 'assign', 'report'));
      DELETE FROM lead_activity WHERE note = 'Sample activity';
    `);
    const seed = seedStaff();
    await db.query("DELETE FROM staff WHERE NOT (id = ANY($1::text[]))", [seed.map((s) => s.id)]);
    await db.query(
      `INSERT INTO staff (id, email, name, role, region, partner_code, password_hash)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, region = EXCLUDED.region, partner_code = EXCLUDED.partner_code`,
      [seed.map((s) => s.id), seed.map((s) => s.email), seed.map((s) => s.name), seed.map((s) => s.role), seed.map((s) => s.region ?? null), seed.map((s) => s.partnerCode ?? null), seed.map((s) => s.passwordHash)],
    );
    const { rows: staff } = await db.query("SELECT id, email, name, role, region, partner_code, password_hash FROM staff ORDER BY created_at, id");
    const { rows: act } = await db.query("SELECT id, lead_id, staff_id, at, kind, outcome, status, note, next_at FROM lead_activity ORDER BY id");
    return {
      staff: staff.map((r) => ({ id: r.id, email: r.email, name: r.name, role: r.role, region: r.region ?? undefined, partnerCode: r.partner_code ?? undefined, passwordHash: r.password_hash })),
      activity: act.map((r) => ({
        id: Number(r.id), leadId: r.lead_id, staffId: r.staff_id, at: new Date(r.at).toISOString(), kind: r.kind,
        outcome: r.outcome ?? undefined, status: r.status ?? undefined, note: r.note, nextAt: r.next_at ? new Date(r.next_at).toISOString() : undefined,
      })),
    };
  }
  let crm: Crm;
  try {
    crm = JSON.parse(fs.readFileSync(FILE, "utf8")) as Crm;
  } catch {
    crm = { staff: [], activity: [] };
  }
  // Same upgrade as the database: today's team, no sample calls.
  if (DEMO_STAFF.some((d) => !crm.staff.some((s) => s.id === d.id)) || crm.staff.length !== DEMO_STAFF.length) {
    crm.staff = seedStaff();
    crm.activity = crm.activity.filter((a) => a.note !== "Sample activity");
    saveFile(crm);
  }
  return crm;
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

export interface LeadBase {
  id: string;
  row: LeadRow;
  region: Region;
  score: Score;
  defaultOwner: string;
  defaultStatus: LeadStatus;
  /** The number they gave us, 91XXXXXXXXXX. */
  phone?: string;
  /** Their advisor conversations, newest first. */
  sessionIds: string[];
  orderIds: string[];
  /** "registered": signed up with us. "winback": a recoverable drop from last quarter's smb_leads.csv. */
  origin: "registered" | "winback";
}

const EMPTY_ROW: LeadRow = { lead_id: "", created_date: "", lead_source: "", business_name: "", business_type: "", segment: "", city: "", city_tier: "", state: "", preferred_language: "", employee_count: "", num_sites: "", annual_turnover_band: "", has_gstin: "", gstin: "", has_udyam: "", udyam_number: "", current_internet: "", current_provider: "", monthly_telecom_spend_inr: "", products_of_interest: "", contact_name: "", contact_role: "", stage_reached: "", outcome: "", drop_reason: "", contacted_date: "", needs_assessed_date: "", quote_accepted_date: "", kyc_complete_date: "", activated_date: "", days_lead_to_activation: "", customer_follow_up_calls: "", bundle_products: "", monthly_bundle_value_inr: "", one_time_setup_inr: "", contract_months: "", churned_within_6_months: "", nps_score: "", acquisition_cost_inr: "" };

/** A WhatsApp chat id is the sender's number (91XXXXXXXXXX, maybe with the WhatsApp suffix); anything else isn't. */
const waNumber = (chatId: string) => /^(91\d{10})(@s\.whatsapp\.net)?$/.exec(chatId)?.[1];
const digits10 = (p: string) => p.replace(/\D/g, "").slice(-10);

/** How likely they are to buy, from what they actually did. Shown with the reasons, like the old call-list score. */
function intentScore(x: { callback: boolean; handoff: boolean; quoted?: number; signedIn: boolean; lastAt: string }): Score {
  const reasons: Score["reasons"] = [];
  let p = 0.04;
  const add = (label: string, effect: number) => ((p += effect), reasons.push({ label, effect }));
  if (x.callback) add("Asked us to call them", 0.35);
  else if (x.handoff) add("Asked to talk to a person", 0.25);
  if (x.quoted) add(`Has a priced plan, ₹${x.quoted.toLocaleString("en-IN")}/month`, 0.2);
  if (x.signedIn) add("Signed in with their number", 0.08);
  if (Date.now() - new Date(x.lastAt).getTime() < 2 * 86_400_000) add("Active in the last two days", 0.06);
  else add("Quiet for more than two days", -0.03);
  const probability = Math.max(0.01, Math.min(0.95, p));
  return { probability, band: probability >= 0.3 ? "hot" : probability >= 0.12 ? "warm" : "cold", reasons };
}

/**
 * The lead book: only businesses that registered with us. Signed-in owners, "request a call" forms, and WhatsApp
 * chats that got a plan or asked for a person, merged by phone number. Rebuilt from the live records on every read.
 */
export function leadBook(): Map<string, LeadBase> {
  const sessions = store.listSessions().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const orders = store.listOrders();
  type Acc = { id: string; phone?: string; name?: string; signedIn: boolean; createdAt: string; source: string; sessions: AdvisorSession[]; orders: Order[]; profile: Profile; language?: string };
  const byPhone = new Map<string, Acc>();
  const out: Acc[] = [];
  const acc = (id: string, phone: string | undefined, init: Omit<Acc, "id" | "phone" | "sessions" | "orders">) => {
    const key = phone ? digits10(phone) : undefined;
    const hit = key ? byPhone.get(key) : undefined;
    if (hit) return hit;
    const a: Acc = { id, phone, sessions: [], orders: [], ...init };
    if (key) byPhone.set(key, a);
    out.push(a);
    return a;
  };
  const customers = store.listCustomers().filter((c) => !c.demo);
  const byCustomer = new Map<string, Acc>();
  for (const c of customers) byCustomer.set(c.id, acc(c.id, c.phone, { name: c.name, signedIn: true, createdAt: c.createdAt, source: "Signed in on the website", profile: c.profile, language: c.language }));
  for (const s of sessions) {
    const owner = s.customerId ? byCustomer.get(s.customerId) : undefined;
    if (owner) {
      owner.sessions.push(s);
      continue;
    }
    const phone = s.callback?.phone ?? (s.botChat?.channel === "whatsapp" ? waNumber(s.botChat.chatId) : undefined);
    if (!phone || !(s.callback || s.status === "handoff" || s.quote || s.orderId)) continue;
    const a = acc(s.id, phone, { name: s.callback?.name, signedIn: false, createdAt: s.createdAt, source: s.callback ? "Asked for a call" : "WhatsApp chat", profile: s.profile, language: s.language });
    a.sessions.push(s);
  }
  for (const o of orders) {
    const phone = o.phone ? `91${digits10(o.phone)}` : undefined;
    const viaSession = o.sessionId ? out.find((a) => a.sessions.some((s) => s.id === o.sessionId)) : undefined;
    const a = viaSession ?? (phone ? acc(o.sessionId ?? o.id, phone, { name: o.contactName, signedIn: false, createdAt: o.createdAt, source: `Ordered on ${o.channel}`, profile: o.profile }) : undefined);
    if (a) {
      a.orders.push(o);
      a.name ??= o.contactName;
    }
  }

  const book = new Map<string, LeadBase>();
  for (const a of out) {
    const latest = a.sessions[0];
    const profile = { ...a.profile, ...(latest?.profile ?? {}) } as Profile;
    const order = a.orders.sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
    const quote = order?.quote ?? latest?.quote;
    const handoff = a.sessions.find((s) => s.status === "handoff");
    const callback = a.sessions.find((s) => s.callback);
    const lastAt = [latest?.updatedAt, order?.createdAt, a.createdAt].filter(Boolean).sort().at(-1)!;
    const live = !!order && order.timeline.clockDay >= 0 && allLive(order.timeline);
    const status: LeadStatus = live ? "customer" : order ? "won" : "to_call";
    const stage = live ? "Activated" : order?.kyc?.result.verdict === "verified" ? "KYC complete" : order ? "Quote accepted" : quote || profile.businessType ? "Needs assessed" : "Lead";
    const row: LeadRow = {
      ...EMPTY_ROW,
      lead_id: a.id,
      created_date: a.createdAt.slice(0, 10),
      lead_source: a.source,
      business_name: profile.businessName || order?.businessName || (profile.businessType ? `${profile.businessType}${profile.city ? `, ${profile.city}` : ""}` : a.name ? `${a.name}'s business` : "New enquiry"),
      business_type: profile.businessType ?? "Business not told yet",
      segment: profile.segment ?? "",
      city: profile.city ?? order?.city ?? "City not told yet",
      preferred_language: langName(latest?.language ?? a.language ?? "en"),
      employee_count: profile.employees ? String(profile.employees) : "",
      num_sites: profile.sites ? String(profile.sites) : "",
      has_gstin: profile.hasGstin ? "Y" : "N",
      current_internet: profile.currentInternet ?? "",
      monthly_telecom_spend_inr: profile.monthlySpend ? String(profile.monthlySpend) : "",
      products_of_interest: (quote?.lines.filter((l) => l.active).map((l) => l.productId) ?? []).join(";"),
      contact_name: a.name ?? callback?.callback?.name ?? order?.contactName ?? "",
      contact_role: "Owner",
      stage_reached: stage,
      outcome: live ? "Activated" : "",
      drop_reason: order ? "" : handoff?.handoff?.reason ?? (quote ? "Got a plan but hasn't ordered" : ""),
    };
    book.set(a.id, {
      id: a.id,
      row,
      region: "West",
      score: intentScore({ callback: !!callback, handoff: !!handoff, quoted: order ? undefined : quote?.monthlyWithGst, signedIn: a.signedIn, lastAt }),
      defaultOwner: AREA_SALESMAN,
      defaultStatus: status,
      phone: a.phone,
      sessionIds: a.sessions.map((s) => s.id),
      orderIds: a.orders.map((o) => o.id),
      origin: "registered",
    });
  }
  return book;
}

const RECOVERABLE = /no time|not scheduled|took too long|too complex|decided to wait|paperwork|signatory|missing gst|unreachable/i;
let winback: Map<string, LeadBase> | undefined;
/**
 * Last quarter's leads that dropped for a reason a call can fix (no time, paperwork, slow install...), ranked by the
 * propensity model trained on smb_leads.csv. Kept apart from the registered book; scored once per process.
 */
export function winbackBook(): Map<string, LeadBase> {
  if (winback) return winback;
  winback = new Map();
  for (const row of datasets().leads) {
    if (row.outcome !== "Dropped" || !RECOVERABLE.test(row.drop_reason)) continue;
    winback.set(row.lead_id, { id: row.lead_id, row, region: regionOf(row.state), score: scoreLead(row), defaultOwner: AREA_SALESMAN, defaultStatus: "to_call", sessionIds: [], orderIds: [], origin: "winback" });
  }
  return winback;
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
  for (const b of [...leadBook().values(), ...winbackBook().values()]) out.set(b.id, { ...b, owner: b.defaultOwner, status: b.defaultStatus, touches: 0 });
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
  return staff.role === "admin" || staff.role === "supervisor" || lead.owner === staff.id;
}

export async function visibleLeads(staff: Pick<Staff, "id" | "role">, origin?: LeadBase["origin"]) {
  return [...(await leadViews()).values()].filter((l) => canSee(staff, l) && (!origin || l.origin === origin));
}

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime();

/**
 * Who to call today: follow-ups that are due first (oldest first), then registered leads nobody has touched in two
 * days (most likely to buy first), then last quarter's recoverable drops ranked by the propensity model.
 */
export async function callQueue(staff: Pick<Staff, "id" | "role">, now = new Date(), limit = 60) {
  const eod = endOfDay(now);
  const twoDays = now.getTime() - 2 * 86_400_000;
  const open = (await visibleLeads(staff)).filter((l) => OPEN_STATUSES.includes(l.status));
  const due = open.filter((l) => l.nextAt && new Date(l.nextAt).getTime() <= eod).sort((a, b) => a.nextAt!.localeCompare(b.nextAt!));
  const untouched = (l: LeadView) => !l.nextAt && (!l.lastTouch || new Date(l.lastTouch.at).getTime() < twoDays);
  const byChance = (a: LeadView, b: LeadView) => b.score.probability - a.score.probability;
  const fresh = open.filter((l) => l.origin === "registered" && untouched(l)).sort(byChance);
  const winbackOpen = open.filter((l) => l.origin === "winback");
  const wb = winbackOpen.filter(untouched).sort(byChance);
  return {
    due,
    fresh: fresh.slice(0, Math.max(0, limit - due.length)),
    winback: wb.slice(0, 25),
    openTotal: open.length - winbackOpen.length,
    winbackTotal: winbackOpen.length,
  };
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

/** The number to call, written the way people read it. */
export function leadPhone(l: Pick<LeadBase, "phone">) {
  const d = l.phone ? digits10(l.phone) : "";
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : "";
}

/** The supervisor's end-of-day reports to the manager, newest first. */
export async function teamReports(limit = 30) {
  return (await crm()).activity.filter((a) => a.kind === "report").reverse().slice(0, limit);
}
