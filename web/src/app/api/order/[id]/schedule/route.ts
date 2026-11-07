import { z } from "zod";
import { publicOrder } from "@/lib/order-view";
import { scheduleInstall } from "@/lib/scheduler";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ slotId: z.string().max(60) });

/** Book or reschedule the installation visit (two free reschedules). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Pick a slot" }, { status: 400 });
  const r = scheduleInstall(o, body.data.slotId);
  if (!r.ok) return Response.json({ error: r.error }, { status: 409 });
  store.saveOrder(o);
  store.audit("owner", "order:schedule", o.id, r.slot.label);
  return Response.json(publicOrder(o));
}
