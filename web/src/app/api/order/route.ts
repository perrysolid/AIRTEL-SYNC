import { z } from "zod";
import { newId, now, store } from "@/lib/store";
import { buildTimeline } from "@/lib/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.string(),
  contactName: z.string().min(2).max(80),
  phone: z.string().regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  partnerCode: z.string().max(20).optional(),
});

/** Turns an accepted quote into an order. KYC, e-sign and payment follow. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const s = store.getSession(body.data.sessionId);
  if (!s?.quote) return Response.json({ error: "No quote to order" }, { status: 404 });
  if (s.orderId && store.getOrder(s.orderId)) return Response.json({ orderId: s.orderId });

  const active = s.quote.lines.filter((l) => l.active && !l.blockedReason);
  const id = newId("ord").toUpperCase().replace("ORD_", "ACC-");
  store.saveOrder({
    id,
    sessionId: s.id,
    createdAt: now(),
    businessName: s.profile.businessName ?? s.profile.businessType ?? "Your business",
    city: s.profile.city,
    contactName: body.data.contactName,
    phone: body.data.phone.replace(/\D/g, "").slice(-10),
    channel: body.data.partnerCode ? "partner" : s.channel,
    partnerCode: body.data.partnerCode,
    profile: s.profile,
    lines: active,
    term: s.quote.term,
    quote: s.quote,
    timeline: buildTimeline(active.map((l) => l.productId)),
    notifications: [{ at: now(), channel: "whatsapp", text: `Hi ${body.data.contactName.split(" ")[0]}! Your Accel Business order ${id} is created. Next: verify your business (takes ~2 minutes). Track anytime: reply STATUS.` }],
  });
  s.orderId = id;
  s.status = "ordered";
  store.saveSession(s);
  store.audit("owner", "order:create", id, `${active.length} lines, ₹${s.quote.monthly}/mo`);
  return Response.json({ orderId: id });
}
