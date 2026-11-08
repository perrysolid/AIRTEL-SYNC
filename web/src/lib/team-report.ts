import { activitySince, listStaff, visibleLeads, OPEN_STATUSES } from "./crm";
import { inr } from "./format";
import { store } from "./store";
import { allLive } from "./tracker";

/**
 * A first draft of the supervisor's end-of-day report, from what actually happened today: calls by each person,
 * what customers were told, orders and installations, and who is still waiting. The supervisor edits it and sends it.
 */
export async function draftReport(now = new Date()): Promise<string> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startIso = start.toISOString();
  const people = await listStaff();
  const acts = (await activitySince(start)).filter((a) => a.kind !== "report");
  const lines: string[] = [];

  for (const p of people.filter((x) => x.role !== "admin")) {
    const mine = acts.filter((a) => a.staffId === p.id);
    const calls = mine.filter((a) => a.kind === "call");
    if (!mine.length) {
      lines.push(`${p.name}: nothing logged today.`);
      continue;
    }
    const connected = calls.filter((a) => a.outcome === "Connected").length;
    const won = mine.filter((a) => a.status === "won").length;
    lines.push(`${p.name}: ${calls.length} call${calls.length === 1 ? "" : "s"} (${connected} connected), ${mine.length - calls.length} other update${mine.length - calls.length === 1 ? "" : "s"}${won ? `, ${won} won` : ""}.`);
  }

  const orders = store.listOrders();
  const newOrders = orders.filter((o) => o.createdAt >= startIso);
  const sent = orders.flatMap((o) => o.notifications.filter((n) => n.at >= startIso && n.text.startsWith("📣")));
  const wentLive = orders.filter((o) => o.timeline.clockDay >= 0 && allLive(o.timeline) && o.notifications.some((n) => n.at >= startIso && n.text.startsWith("🎉")));
  const installing = orders.filter((o) => o.esign && !allLive(o.timeline));
  lines.push(
    newOrders.length ? `New orders: ${newOrders.length} (${inr(newOrders.reduce((s, o) => s + o.quote.monthlyWithGst, 0))} a month).` : "No new orders today.",
    `Installations: ${installing.length} in progress, ${wentLive.length} went fully live today. ${sent.length} update${sent.length === 1 ? "" : "s"} sent to owners on WhatsApp by the team.`,
  );

  const open = (await visibleLeads({ id: "", role: "supervisor" })).filter((l) => OPEN_STATUSES.includes(l.status));
  const waiting = open.filter((l) => !l.lastTouch);
  const handoffs = store.listSessions().filter((s) => s.status === "handoff");
  lines.push(`Still to do: ${open.length} open lead${open.length === 1 ? "" : "s"}, ${waiting.length} not called yet; ${handoffs.length} asked to talk to a person.`);
  return lines.join("\n");
}
