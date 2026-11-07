import { addFailover } from "@/lib/continuity";
import { publicOrder } from "@/lib/order-view";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-tap: add Backup 4G/5G Failover to the order (re-priced by the normal pricing engine). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const r = addFailover(o);
  if (!r.ok) return Response.json({ error: r.error }, { status: 409 });
  store.saveOrder(o);
  store.audit("owner", "order:add_failover", o.id);
  return Response.json(publicOrder(o));
}
