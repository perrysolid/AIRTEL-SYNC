import { product } from "./catalogue";
import { FIXED_LINES } from "./network";
import { notifyOrder } from "./notify";
import { partnerFor } from "./partners";
import { buildQuote, unitPrice, type Term } from "./pricing";
import type { BundleLine } from "./recommend";
import { newId, now, type Incident, type Order, type Ticket } from "./store";

/**
 * Continuity: service health, outage handling, support tickets and the "is a backup link worth it" estimate.
 * Outage events are SIMULATED for the demo; in production they would come from router/network telemetry.
 */

export const SALES_PER_HOUR: Record<string, number> = { micro: 500, prof: 1500, multi: 8000, mfg: 12000 };
export const PLAN_MBPS: Record<string, number> = { P01: 100, P02: 300, P03: 1000, P04: 100, P05: 20, P06: 100 };
const OUTAGE_MINUTES = 47;

export const hasFailover = (o: Order) => o.lines.some((l) => l.productId === "P09");
const hasFixedLine = (o: Order) => o.lines.some((l) => FIXED_LINES.includes(l.productId));
const sitesOf = (o: Order) => Math.max(1, o.profile.sites ?? 1);

export interface ContinuityView {
  hasFailover: boolean;
  canAddFailover: boolean;
  salesPerHour: number;
  dependentPct: number;
  outageHoursMonth: number;
  estLossMonth: number;
  failoverMonthly: number;
  failoverMonthlyWithGst: number;
  breakevenHoursMonth?: number;
  worthIt: boolean;
  assumptions: string;
  outageActive: boolean;
  incidents: Incident[];
}

export function continuity(o: Order, opts: { salesPerHour?: number; dependentPct?: number; hours?: number } = {}): ContinuityView {
  const sph = opts.salesPerHour ?? SALES_PER_HOUR[o.profile.segment ?? "micro"] ?? 500;
  const dep = opts.dependentPct ?? 60;
  const hours = opts.hours ?? 4;
  const has = hasFailover(o);
  const monthly = unitPrice("P09", o.term) * sitesOf(o);
  const atRisk = (sph * dep) / 100;
  const loss = atRisk * hours;
  return {
    hasFailover: has,
    canAddFailover: hasFixedLine(o) && !has,
    salesPerHour: sph,
    dependentPct: dep,
    outageHoursMonth: hours,
    estLossMonth: Math.round(loss),
    failoverMonthly: monthly,
    failoverMonthlyWithGst: Math.round(monthly * 1.18),
    breakevenHoursMonth: atRisk ? Math.round((monthly / atRisk) * 10) / 10 : undefined,
    worthIt: loss > monthly,
    assumptions: "Estimates use your inputs; real outage hours vary by area and provider.",
    outageActive: !!o.outageActive,
    incidents: o.incidents ?? [],
  };
}

export function createTicket(o: Order, kind: Ticket["kind"], detail: string, stepsTried: string[] = []): Ticket {
  const slaHours = kind === "outage" || kind === "no_internet" ? 4 : 24;
  const t: Ticket = { id: newId("tkt").toUpperCase().replace("TKT_", "TKT-").slice(0, 9), kind, detail, stepsTried, at: now(), status: "Open", slaHours, assignedTo: partnerFor(o.city) };
  (o.tickets ??= []).unshift(t);
  notifyOrder(o, `🎫 Ticket ${t.id} raised (${kind.replace("_", " ")}). ${t.assignedTo} will fix it within ${slaHours} hours; we'll update you here.`);
  return t;
}

export function startOutage(o: Order): Incident | undefined {
  if (o.outageActive) return undefined;
  o.outageActive = true;
  const failover = hasFailover(o);
  const inc: Incident = { id: newId("inc").toUpperCase().replace("INC_", "INC-").slice(0, 8), at: now(), failover, minutes: 0, status: "Active", switchSeconds: failover ? 8 : undefined };
  if (failover) {
    notifyOrder(o, "🛟 Main internet link dropped. Backup 4G/5G took over in 8 seconds. Billing and payments are still working. We're fixing the main link.");
  } else {
    const t = createTicket(o, "outage", "Main link down; no backup attached.", ["Auto-detected by SYNC Health"]);
    inc.ticketId = t.id;
    const tip = hasFixedLine(o) ? "Tip: a Backup 4G/5G add-on would have kept you online. Reply BACKUP to add it." : "Tip: ask your partner about adding a fixed line plus backup for continuity.";
    notifyOrder(o, `🚨 Your internet is down. Ticket ${t.id} raised automatically, fix expected within 4 hours. ${tip}`);
  }
  (o.incidents ??= []).unshift(inc);
  return inc;
}

export function endOutage(o: Order): Incident | undefined {
  if (!o.outageActive) return undefined;
  o.outageActive = false;
  const inc = o.incidents?.[0];
  if (!inc) return undefined;
  inc.status = "Resolved";
  inc.minutes = OUTAGE_MINUTES;
  for (const t of o.tickets ?? []) if (t.id === inc.ticketId) t.status = "Resolved";
  notifyOrder(o, `✅ Main link restored after ${OUTAGE_MINUTES} minutes.` + (inc.failover ? " You stayed online throughout." : " You were offline for 47 minutes; a Backup add-on prevents this."));
  return inc;
}

export type AddFailoverResult = { ok: true; added: boolean } | { ok: false; error: string };

/** Adds Backup 4G/5G Failover (one per site) to the order and re-prices it through the normal pricing engine. */
export function addFailover(o: Order): AddFailoverResult {
  if (hasFailover(o)) return { ok: true, added: false };
  if (!hasFixedLine(o)) return { ok: false, error: "Backup failover needs a fixed-line plan (fibre or leased line)." };
  const lines: BundleLine[] = o.lines.map((l) => ({ productId: l.productId, qty: l.qty, optional: false, reason: l.reason }));
  lines.push({ productId: "P09", qty: sitesOf(o), optional: false, reason: "If the main link drops, a 4G/5G backup takes over automatically so billing never stops." });
  const quote = buildQuote({ lines, term: o.term as Term, currentMonthlySpend: o.profile.monthlySpend });
  o.quote = quote;
  o.lines = quote.lines.filter((l) => l.active && !l.blockedReason);
  const internet = o.timeline.tracks.find((t) => t.key === "internet");
  if (internet && !internet.productIds.includes("P09")) internet.productIds.push("P09");
  const l = o.lines.find((x) => x.productId === "P09")!;
  notifyOrder(o, `🛟 Backup 4G/5G Failover added (+₹${Math.round(l.monthly * 1.18).toLocaleString("en-IN")}/month incl. GST). Router arrives in ${product("P09").installDays} days.`);
  return { ok: true, added: true };
}

/** Compares a measured speed with the plan; below 80% is treated as a fault and ticketed. */
export function checkSpeed(o: Order, mbps: number): { plan?: number; measured: number; ok: boolean; ticket?: Ticket } {
  const plan = o.lines.map((l) => PLAN_MBPS[l.productId]).find(Boolean);
  if (!plan) return { measured: mbps, ok: true };
  const ok = mbps >= 0.8 * plan;
  return { plan, measured: mbps, ok, ticket: ok ? undefined : createTicket(o, "slow_speed", `Measured ${mbps} Mbps vs ${plan} Mbps plan (<80%).`, ["Speed test shared on chat"]) };
}
