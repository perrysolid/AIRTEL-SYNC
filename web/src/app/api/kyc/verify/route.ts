import { z } from "zod";
import { validateKyc, type KycDocs } from "@/lib/kyc";
import { ExtractedDocSchema, DOC_TYPES } from "@/lib/kyc-types";
import { now, store } from "@/lib/store";
import { notifyOrder } from "@/lib/notify";
import { publicOrder } from "@/lib/order-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  orderId: z.string(),
  /** The owner can correct a misread field before verifying; registries still arbitrate. */
  docs: z.partialRecord(z.enum(DOC_TYPES), ExtractedDocSchema).default({}),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  const o = store.getOrder(body.data.orderId);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  if (!o.consentId) return Response.json({ error: "KYC consent required" }, { status: 403 });

  const result = validateKyc(body.data.docs as KycDocs);
  const gst = body.data.docs.gst_certificate?.fields.gstin ?? undefined;
  const udyam = body.data.docs.udyam_certificate?.fields.udyamNumber ?? undefined;
  o.kyc = { result, docs: o.kyc?.docs ?? [], at: now(), registryLookups: { gstin: gst ?? undefined, udyam: udyam ?? undefined } };
  if (gst) o.profile = { ...o.profile, gstin: gst };
  if (udyam) o.profile = { ...o.profile, udyam };
  notifyOrder(
    o,
    result.verdict === "verified"
        ? "✅ Business verified in under 2 minutes. Next: e-sign your agreement with Aadhaar OTP."
        : result.verdict === "rejected"
          ? "🔎 Our verification team is reviewing your documents and will call within 4 working hours. No need to chase us — we'll update you here."
          : `📄 Almost there: ${result.actions[0] ?? "one document needs a fix"}.`,
  );
  store.saveOrder(o);
  store.audit("system", `kyc:${result.verdict}`, o.id, result.checks.filter((c) => c.status === "fail").map((c) => c.id).join(","));
  return Response.json(publicOrder(o));
}
