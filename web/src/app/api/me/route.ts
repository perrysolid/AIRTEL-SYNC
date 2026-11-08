import { cookies } from "next/headers";
import { z } from "zod";
import { CUSTOMER_COOKIE } from "@/lib/auth";
import { maskPhone } from "@/lib/customers";
import { currentCustomer } from "@/lib/customer-session";
import { withinWhatsAppWindow } from "@/lib/notify";
import { publicOrder } from "@/lib/order-view";
import { NEED_LABELS } from "@/lib/profile";
import { store } from "@/lib/store";
import { WHATSAPP_NUMBER } from "@/lib/winback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in customer's account: what we remember, their orders with the latest updates, and how updates reach them. */
export async function GET() {
  const c = await currentCustomer();
  if (!c) return Response.json({ signedIn: false }, { status: 401 });
  const orders = c.orderIds
    .map((id) => store.getOrder(id))
    .filter((o) => !!o)
    .map((o) => {
      const v = publicOrder(o);
      const next = v.steps.find((s) => !s.done);
      return { id: v.id, businessName: v.businessName, createdAt: v.createdAt, monthlyWithGst: v.quote.monthlyWithGst, steps: v.steps, next: next?.label, updates: v.notifications.slice(-6).reverse() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const p = c.profile;
  return Response.json({
    signedIn: true,
    name: c.name ?? null,
    phone: c.demo ? null : maskPhone(c.phone),
    demo: !!c.demo,
    language: c.language ?? null,
    memory: {
      business: [...new Set([p.businessName, p.businessType].filter(Boolean))].join(", ") || null,
      city: p.city ?? null,
      team: p.employees ?? null,
      gst: p.hasGstin ?? null,
      internetToday: p.currentInternet ?? null,
      spendToday: p.monthlySpend ?? null,
      budget: p.budget ?? null,
      needs: (p.needs ?? []).map((n) => NEED_LABELS[n]),
      declined: c.declinedProducts,
    },
    lastPlan: c.lastPlan ?? null,
    orders,
    notify: c.notify,
    telegramLinked: !!c.telegramChatId,
    whatsappWindowOpen: withinWhatsAppWindow(c.whatsappInboundAt),
    whatsappLink: `https://wa.me/${WHATSAPP_NUMBER()}?text=${encodeURIComponent("Hi")}`,
  });
}

const Patch = z.object({ name: z.string().max(60).optional(), notify: z.object({ whatsapp: z.boolean(), telegram: z.boolean() }).partial().optional() });

export async function PATCH(req: Request) {
  const c = await currentCustomer();
  if (!c) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = Patch.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  if (body.data.name?.trim()) c.name = body.data.name.trim();
  c.notify = { ...c.notify, ...body.data.notify };
  store.saveCustomer(c);
  return Response.json({ ok: true });
}

/** "Forget me": deletes the account and everything remembered. Orders remain, as contracts, without the link. */
export async function DELETE() {
  const c = await currentCustomer();
  if (!c) return Response.json({ error: "Sign in first." }, { status: 401 });
  for (const id of c.sessionIds) {
    const s = store.getSession(id);
    if (s) store.saveSession({ ...s, customerId: undefined, memoryBrief: undefined });
  }
  store.deleteCustomer(c.id);
  store.audit("customer", "customer:forget", c.id, c.demo ? "demo" : maskPhone(c.phone));
  (await cookies()).delete(CUSTOMER_COOKIE);
  return Response.json({ ok: true });
}
