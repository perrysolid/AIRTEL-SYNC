import { z } from "zod";
import { continuity, endOutage, startOutage } from "@/lib/continuity";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["start", "end"]) });

/** Demo control: simulate an outage and its recovery. With a backup link the owner stays online; without one a ticket is raised. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "action must be start or end" }, { status: 400 });
  if (body.data.action === "start") startOutage(o);
  else endOutage(o);
  store.saveOrder(o);
  store.audit("owner", `order:outage_${body.data.action}`, o.id);
  return Response.json(continuity(o));
}
