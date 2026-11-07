import { z } from "zod";
import { PURPOSES, type Purpose } from "@/lib/privacy";
import { now, store } from "@/lib/store";
import { publicOrder } from "@/lib/order-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  orderId: z.string(),
  phoneLast4: z.string().regex(/^\d{4}$/),
  action: z.enum(["export", "withdraw", "erase"]),
  purpose: z.string().optional(),
});

/**
 * Data principal rights (DPDP ss.11-13): access, withdraw consent, erasure.
 * A light possession check (last 4 digits of the registered mobile) gates it;
 * production would use an OTP.
 */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  const o = store.getOrder(body.data.orderId);
  if (!o || !o.phone?.endsWith(body.data.phoneLast4)) return Response.json({ error: "Order not found for that number" }, { status: 404 });

  switch (body.data.action) {
    case "export": {
      const consent = o.consentId ? store.getConsent(o.consentId) : undefined;
      store.audit("owner", "privacy:export", o.id);
      return Response.json({
        exportedAt: now(),
        order: publicOrder(o),
        consent,
        storedKycFields: o.kyc?.docs.map((d) => ({ docType: d.docType, fields: d.fields, sha256: d.sha256, at: d.at })),
        note: "Document images are never stored. These are the only details we keep from your documents.",
      });
    }
    case "withdraw": {
      const p = body.data.purpose as Purpose;
      if (!o.consentId || !(p in PURPOSES)) return Response.json({ error: "Unknown purpose" }, { status: 400 });
      if (PURPOSES[p].required && o.payment) {
        return Response.json({ error: "This consent is needed to keep your services running. To stop it, close your account and we'll erase your data after the legal retention period." }, { status: 409 });
      }
      store.withdrawConsent(o.consentId, p);
      store.audit("owner", "privacy:withdraw", o.id, p);
      return Response.json({ ok: true, consent: store.getConsent(o.consentId) });
    }
    case "erase": {
      if (o.payment) return Response.json({ error: "Active services: erasure is scheduled for when you close your account (statutory retention applies)." }, { status: 409 });
      if (o.kyc) o.kyc.docs = o.kyc.docs.map((d) => ({ ...d, fields: {} }));
      o.contactName = "[erased]";
      o.phone = "";
      o.profile = { needs: [] };
      store.saveOrder(o);
      store.audit("owner", "privacy:erase", o.id);
      return Response.json({ ok: true });
    }
  }
}
