import crypto from "node:crypto";
import { z } from "zod";
import { now, store } from "@/lib/store";
import { notifyOrder } from "@/lib/notify";
import { publicOrder } from "@/lib/order-view";
import { advance, fallbackToAirFiber } from "@/lib/tracker";
import { sha256 } from "@/lib/privacy";
import { unitPrice } from "@/lib/pricing";
import { product } from "@/lib/catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("esign"), otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP") }),
  z.object({ action: z.literal("pay"), method: z.enum(["upi_autopay", "card", "netbanking"]) }),
  z.object({ action: z.literal("next_day") }),
  z.object({ action: z.literal("fibre_not_feasible") }),
]);

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
      // Mock Aadhaar OTP e-sign: we sign a hash of the agreement, never the Aadhaar number.
      const agreement = JSON.stringify({ order: o.id, lines: o.lines.map((l) => [l.productId, l.qty, l.unitPrice]), term: o.term, monthly: o.quote.monthly });
      o.esign = { at: now(), method: "aadhaar-otp-mock", docHash: sha256(agreement) };
      notify("✍️ Agreement e-signed. A copy is in your email. Next: set up UPI AutoPay for the first bill.");
      break;
    }
    case "pay": {
      if (!o.esign) return Response.json({ error: "E-sign the agreement first" }, { status: 409 });
      const amount = o.quote.monthlyWithGst + o.quote.setupTotal;
      o.payment = { at: now(), method: body.data.method, amount, ref: `UPI${crypto.randomInt(1e9, 9e9)}` };
      o.timeline.clockDay = 0;
      // One chat message per event: payment + whatever goes live today.
      notifyOrder(o, [`💳 Payment of ₹${amount.toLocaleString("en-IN")} received. Activation has started — your mobile lines go live today.`, ...advance(o.timeline, 0)]);
      break;
    }
    case "next_day": {
      if (o.timeline.clockDay < 0) return Response.json({ error: "Activation hasn't started" }, { status: 409 });
      notifyOrder(o, advance(o.timeline, 1));
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
