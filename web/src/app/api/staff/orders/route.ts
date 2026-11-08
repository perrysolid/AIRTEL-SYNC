import { ordersFor } from "@/lib/sales-data";
import { orderRow, staffOr401 } from "@/lib/staff-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Orders this person looks after (managers: all), newest first. */
export async function GET() {
  const a = await staffOr401();
  if ("res" in a) return a.res;
  return Response.json({ orders: (await ordersFor(a.staff)).map(orderRow) });
}
