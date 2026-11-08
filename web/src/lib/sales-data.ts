import { activitySince, callQueue, leadViews, listStaff, OPEN_STATUSES, STATUSES, visibleLeads, type LeadStatus, type LeadView } from "./crm";
import type { SignedInStaff } from "./staff-session";
import { store, type Order } from "./store";
import { liveDay } from "./tracker";

/** Read models for the sales portal pages, already scoped to what this person may see. */

export async function ordersFor(staff: SignedInStaff): Promise<Order[]> {
  const all = store.listOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (staff.role === "admin" || staff.role === "supervisor") return all;
  // The salesman sees the orders of the businesses he looks after, and anything nobody has been given yet.
  const book = [...(await leadViews()).values()];
  return all.filter((o) => {
    const lead = book.find((l) => l.orderIds.includes(o.id));
    return !lead || lead.owner === staff.id;
  });
}

export function orderStage(o: Order) {
  if (o.timeline.clockDay >= 0) return o.timeline.clockDay >= liveDay(o.timeline) ? (o.payment ? "Live" : "Live, first bill due") : `Activating, day ${o.timeline.clockDay} of ${liveDay(o.timeline)}`;
  if (o.kyc?.result.verdict === "verified") return "Awaiting e-sign";
  if (o.kyc) return "KYC needs attention";
  return o.consentId ? "Uploading documents" : "Awaiting consent";
}

const STAGES = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"];
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function dashboard(staff: SignedInStaff, now = new Date()) {
  const leads = await visibleLeads(staff);
  const queue = await callQueue(staff, now);
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
  const acts = (await activitySince(since)).filter((a) => a.kind === "call" && (staff.role === "admin" || staff.role === "supervisor" || a.staffId === staff.id));
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const orders = await ordersFor(staff);

  const days = Array.from({ length: 14 }, (_, i) => new Date(since.getFullYear(), since.getMonth(), since.getDate() + i));
  const callsByDay = days.map((d) => {
    const k = d.toLocaleDateString("en-CA");
    const day = acts.filter((a) => new Date(a.at).toLocaleDateString("en-CA") === k);
    return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: day.length, tip: `${day.length} calls, ${day.filter((a) => a.outcome === "Connected").length} connected` };
  });

  const reached = (l: LeadView) => STAGES.indexOf(l.row.stage_reached);
  const funnel = STAGES.map((s, i) => ({ label: s, count: leads.filter((l) => reached(l) >= i).length }));

  const sources = new Map<string, { n: number; act: number }>();
  for (const l of leads) {
    const s = sources.get(l.row.lead_source) ?? { n: 0, act: 0 };
    s.n++;
    if (l.row.outcome === "Activated") s.act++;
    sources.set(l.row.lead_source, s);
  }
  const bySource = [...sources.entries()].map(([label, s]) => ({ label, value: s.act / s.n, sub: `${s.n.toLocaleString("en-IN")} leads` })).sort((a, b) => b.value - a.value);

  const statusParts = (["to_call", "contacted", "interested", "quote_sent", "won", "customer"] as LeadStatus[]).map((k) => ({ label: STATUSES[k], value: leads.filter((l) => l.status === k).length }));

  const open = leads.filter((l) => OPEN_STATUSES.includes(l.status));
  const buckets = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
  const scoreDist = buckets.map((b, i) => {
    const hi = buckets[i + 1] ?? 1;
    return { label: `${Math.round(b * 100)}${buckets[i + 1] ? `–${Math.round(hi * 100)}` : "+"}%`, value: open.filter((l) => l.score.probability >= b && l.score.probability < hi).length };
  });

  return {
    kpis: {
      open: open.length,
      due: queue.due.length,
      hotUntouched: open.filter((l) => l.score.band === "hot" && !l.lastTouch).length,
      calls7: acts.filter((a) => a.at >= weekAgo).length,
      connected7: acts.filter((a) => a.at >= weekAgo && a.outcome === "Connected").length,
      won: leads.filter((l) => l.status === "won").length,
      orders: orders.length,
      orderMrr: orders.filter((o) => o.esign).reduce((s, o) => s + o.quote.monthly, 0),
    },
    callsByDay,
    funnel,
    bySource,
    statusParts,
    scoreDist,
    top: [...queue.due, ...queue.fresh].slice(0, 6),
    today: dayKey(now),
  };
}

export async function teamBoard(now = new Date()) {
  const staff = (await listStaff()).filter((s) => s.role !== "admin");
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const acts = await activitySince(new Date(now.getTime() - 14 * 86_400_000));
  const views = [...(await leadViews()).values()];
  return staff.map((s) => {
    const mine = acts.filter((a) => a.staffId === s.id && a.kind === "call");
    const week = mine.filter((a) => new Date(a.at) >= weekAgo);
    const book = views.filter((l) => l.owner === s.id);
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      region: s.region,
      calls7: week.length,
      connectRate: week.length ? week.filter((a) => a.outcome === "Connected").length / week.length : 0,
      open: book.filter((l) => OPEN_STATUSES.includes(l.status)).length,
      overdue: book.filter((l) => OPEN_STATUSES.includes(l.status) && l.nextAt && new Date(l.nextAt) < now).length,
      won: book.filter((l) => l.status === "won").length,
      quotes: book.filter((l) => l.status === "quote_sent").length,
    };
  });
}
