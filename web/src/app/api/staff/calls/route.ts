import { callQueue, listStaff } from "@/lib/crm";
import { leadRow, staffOr401 } from "@/lib/staff-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who to call today: follow-ups due, registered leads most likely to buy, and last quarter's win-back list by propensity. */
export async function GET() {
  const a = await staffOr401();
  if ("res" in a) return a.res;
  const q = await callQueue(a.staff);
  const names = new Map((await listStaff()).map((s) => [s.id, s.name]));
  return Response.json({ due: q.due.map((l) => leadRow(l, names)), fresh: q.fresh.map((l) => leadRow(l, names)), winback: q.winback.map((l) => leadRow(l, names)), openTotal: q.openTotal, winbackTotal: q.winbackTotal });
}
