import crypto from "node:crypto";
import { z } from "zod";
import { now, store, type Order } from "@/lib/store";
import { notifyOrder } from "@/lib/notify";
import { publicOrder } from "@/lib/order-view";
import { advance, fallbackToAirFiber, liveDay } from "@/lib/tracker";
import { sha256 } from "@/lib/privacy";
import { unitPrice } from "@/lib/pricing";
import { product } from "@/lib/catalogue";
import { currentCustomer } from "@/lib/customer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  /** Without an OTP, the owner signs as their signed-in account: they proved this number at sign-in. */
  z.object({ action: z.literal("esign"), otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP").optional() }),
  z.object({ action: z.literal("pay"), method: z.enum(["upi_autopay", "card", "netbanking"]) }),
  z.object({ action: z.literal("next_day") }),
  z.object({ action: z.literal("fibre_not_feasible") }),
]);

/** When the updates include going live, the first bill follows them, then a request for feedback. */
function withBill(o: Order, msgs: string[]): string[] {
  if (!msgs.length || o.timeline.clockDay < liveDay(o.timeline) || o.payment) return msgs;
  const q = o.quote;
  const setup = q.setupTotal ? ` + one-time setup ₹${q.setupTotal.toLocaleString("en-IN")}` : "";
  return [
    ...msgs,
    `🧾 Your first bill: ₹${(q.monthlyWithGst + q.setupTotal).toLocaleString("en-IN")} (first month ₹${q.monthlyWithGst.toLocaleString("en-IN")} incl. GST${setup}). Pay by UPI in your tracker; turn on AutoPay and the months after pay themselves.`,
    "⭐ How did the installation go? Reply with a number from 1 (poor) to 5 (great).",
  ];
}

/** Owner actions (e-sign, pay) and demo-clock controls for the tracker. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const notify = (text: string) => notifyOrder(o, text);

  switch (body.data.action) {
    case "esign": {
      if (o.kyc?.result.verdict !== "verified") return Response.json({ error: "Verify your business first" }, { status: 409 });
      // Signed in with this order's number (or the order is on their account): no second OTP. Otherwise a mock
      // Aadhaar OTP e-sign. Either way we sign a hash of the agreement, never the Aadhaar number.
      let method: "aadhaar-otp-mock" | "verified-mobile" = "aadhaar-otp-mock";
      if (!body.data.otp) {
        const c = await currentCustomer();
        const owns = !!c && (c.orderIds.includes(o.id) || (!!o.phone && c.phone === `91${o.phone}`) || (!!c.demo && !o.phone));
        if (!owns) return Response.json({ error: "Enter the 6-digit OTP" }, { status: 403 });
        method = "verified-mobile";
        store.audit("customer", "order:esign-signed-in", o.id, c!.id);
      }
      const agreement = JSON.stringify({ order: o.id, lines: o.lines.map((l) => [l.productId, l.qty, l.unitPrice]), term: o.term, monthly: o.quote.monthly });
      o.esign = { at: now(), method, docHash: sha256(agreement) };
      // Installation starts the moment they sign. Nothing is charged until every service is live.
      // Moving the clock from "not started" to day 0 sends today's updates too (numbers reserved, router packed…).
      notifyOrder(o, [
        `✍️ Agreement signed. A copy is in your email.\n\nInstallation starts today and you pay nothing until everything is live. We'll message you at every step, so there's no need to call.`,
        ...withBill(o, o.timeline.clockDay < 0 ? advance(o.timeline, 1) : []),
      ]);
      break;
    }
    case "pay": {
      if (!o.esign) return Response.json({ error: "Sign the agreement first" }, { status: 409 });
      if (o.timeline.clockDay < liveDay(o.timeline)) return Response.json({ error: "Your first bill comes once everything is live." }, { status: 409 });
      if (o.payment) return Response.json(publicOrder(o));
      const amount = o.quote.monthlyWithGst + o.quote.setupTotal;
      o.payment = { at: now(), method: body.data.method, amount, ref: `UPI${crypto.randomInt(1e9, 9e9)}` };
      notify(`💳 Paid ₹${amount.toLocaleString("en-IN")}, thank you. Receipt ${o.payment.ref} is in your email.${body.data.method === "upi_autopay" ? " AutoPay is on, so future bills pay themselves; you can stop it any time from your UPI app." : ""}`);
      break;
    }
    case "next_day": {
      if (o.timeline.clockDay < 0) return Response.json({ error: "Installation hasn't started" }, { status: 409 });
      notifyOrder(o, withBill(o, advance(o.timeline, 1)));
      break;
    }
    case "fibre_not_feasible": {
      const msg = fallbackToAirFiber(o.timeline);
      if (!msg) return Response.json({ error: "No fibre line on this order" }, { status: 409 });
      const price = unitPrice("P04", o.term);
      const p04 = product("P04");
      o.lines = o.lines
        .filter((l) => l.productId !== "P11") // static IP needs fibre
        .map((l) => (["P01", "P02", "P03"].includes(l.productId) ? { ...l, productId: "P04", name: p04.name, unitPrice: price, monthly: price * l.qty, installDays: p04.installDays, reason: "Switched from fibre: no cabling needed" } : l));
      notify(msg);
      break;
    }
  }
  store.saveOrder(o);
  store.audit("owner", `order:${body.data.action}`, o.id);
  return Response.json(publicOrder(o));
}
