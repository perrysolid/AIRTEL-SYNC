import { z } from "zod";
import { store } from "@/lib/store";
import { createOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.string(),
  contactName: z.string().min(2).max(80),
  phone: z.string().regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  partnerCode: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const s = store.getSession(body.data.sessionId);
  if (!s?.quote) return Response.json({ error: "No quote to order" }, { status: 404 });
  if (s.orderId && store.getOrder(s.orderId)) return Response.json({ orderId: s.orderId });

  const o = createOrder(s, body.data);
  return Response.json({ orderId: o.id });
}
