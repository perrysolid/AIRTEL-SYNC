import { leadSummary } from "@/lib/analytics";
import { listStaff } from "@/lib/crm";
import { dashboard } from "@/lib/sales-data";
import { leadRow, staffOr401 } from "@/lib/staff-api";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Home screen: KPIs, today's best calls, the funnel; managers also get the quarter's numbers and live journey stats. */
export async function GET() {
  const a = await staffOr401();
  if ("res" in a) return a.res;
  const d = await dashboard(a.staff);
  const names = new Map((await listStaff()).map((s) => [s.id, s.name]));
  const sessions = store.listSessions();
  const orders = store.listOrders();
  const day = Date.now() - 86_400_000;
  return Response.json({
    ...d,
    top: d.top.map((l) => leadRow(l, names)),
    live: {
      chatsToday: sessions.filter((s) => s.updatedAt >= new Date(day).toISOString()).length,
      handoffs: sessions.filter((s) => s.status === "handoff").length,
      ordersToday: orders.filter((o) => o.createdAt >= new Date(day).toISOString()).length,
      updatesSent: orders.reduce((n, o) => n + o.notifications.length, 0),
    },
    quarter: a.staff.role === "admin" ? (({ funnel, activationRate, avgDaysToActivate, avgChaseCalls, cacPerActivation, churn6m, dropReasons, bySource, model }) => ({ funnel, activationRate, avgDaysToActivate, avgChaseCalls, cacPerActivation, churn6m, dropReasons: dropReasons.slice(0, 6), bySource, model }))(leadSummary()) : null,
  });
}
