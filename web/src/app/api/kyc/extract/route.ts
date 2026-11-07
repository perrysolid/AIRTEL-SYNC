import { extractDocument } from "@/lib/extract";
import { DOC_TYPES, type DocType } from "@/lib/kyc-types";
import { sha256, redactText } from "@/lib/privacy";
import { now, store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Reads one uploaded KYC document. Purpose limitation: refuses to run unless
 * KYC consent is on record for the order. The image is processed in memory
 * and discarded; only its hash and the minimal extracted fields are kept.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const orderId = String(form.get("orderId") ?? "");
  const hint = String(form.get("docType") ?? "") as DocType;
  const file = form.get("file");
  const o = store.getOrder(orderId);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const consent = o.consentId && store.getConsent(o.consentId);
  if (!consent || !consent.purposes.kyc_verification) return Response.json({ error: "KYC consent required before reading documents" }, { status: 403 });
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (!TYPES.has(file.type)) return Response.json({ error: "Upload a photo (PNG, JPG or WebP)" }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File too large (max 6 MB)" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await extractDocument(buf, file.type as "image/png", DOC_TYPES.includes(hint) ? hint : undefined);
  const docType = result.doc.docType === "unknown" ? hint : result.doc.docType;

  o.kyc ??= { result: { verdict: "needs_attention", checks: [], summary: "", actions: [] }, docs: [], at: now(), registryLookups: {} };
  o.kyc.docs = o.kyc.docs.filter((d) => d.docType !== docType);
  o.kyc.docs.push({ docType, sha256: sha256(buf), engine: result.engine, fields: result.doc.fields, legible: result.doc.legible, at: now() });
  store.saveOrder(o);
  store.audit("system", "kyc:extract", o.id, `${docType} via ${result.engine} in ${result.ms}ms; ${redactText(String(result.doc.fields.gstin ?? ""))}`);
  return Response.json({ docType, engine: result.engine, ms: result.ms, doc: { ...result.doc, docType } });
}
