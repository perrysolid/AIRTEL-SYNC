import { z } from "zod";
import { createTicket } from "@/lib/continuity";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ kind: z.enum(["outage", "no_internet", "slow_speed", "billing", "other"]).default("other"), detail: z.string().max(500).default("") });

/** Raise a support ticket; it is routed to the partner for the order's city with an SLA. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const t = createTicket(o, body.data.kind, body.data.detail);
  store.saveOrder(o);
  store.audit("owner", "order:ticket", o.id, t.id);
  return Response.json(t);
}
