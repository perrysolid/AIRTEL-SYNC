import { leadSummary } from "@/lib/analytics";
import { staffOr401 } from "@/lib/staff-api";
import { store } from "@/lib/store";
import { allLive, liveDay } from "@/lib/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manager and supervisor: last quarter's baseline from smb_leads.csv (the funnel and the numbers the case set out to
 * move), the targets from the business case, and the same measures on the digital journey so far.
 */
export async function GET() {
  const a = await staffOr401(["admin", "supervisor"]);
  if ("res" in a) return a.res;
  const { funnel, activationRate, avgDaysToActivate, avgChaseCalls, cacPerActivation, churn6m, dropReasons, bySource, model } = leadSummary();
  const sessions = store.listSessions();
  const orders = store.listOrders();
  const quoted = sessions.filter((s) => s.quote).length;
  return Response.json({
    baseline: { funnel, activationRate, avgDaysToActivate, avgChaseCalls, cacPerActivation, churn6m, dropReasons: dropReasons.slice(0, 6), bySource, model },
    targets: [
      { metric: "Lead to activation", today: `${(activationRate * 100).toFixed(1)}%`, target: "12–15%" },
      { metric: "Days to first service", today: avgDaysToActivate.toFixed(1), target: "1 (all live within 21)" },
      { metric: "Cost per activation", today: `₹${Math.round(cacPerActivation).toLocaleString("en-IN")}`, target: "under ₹6,000" },
      { metric: "Status chase calls per customer", today: avgChaseCalls.toFixed(1), target: "under 0.5" },
    ],
    digital: {
      conversations: sessions.length,
      quoted,
      orders: orders.length,
      live: orders.filter((o) => o.timeline.clockDay >= 0 && allLive(o.timeline)).length,
      avgPlannedDays: orders.length ? orders.reduce((s, o) => s + liveDay(o.timeline), 0) / orders.length : null,
      updatesPerOrder: orders.length ? orders.reduce((s, o) => s + o.notifications.length, 0) / orders.length : null,
    },
  });
}
