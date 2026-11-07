import { z } from "zod";
import { lookupGstin, lookupUdyam } from "@/lib/registry";
import type { ExtractedDoc } from "@/lib/kyc-types";
import { store } from "@/lib/store";
import { CASE_TODAY } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ orderId: z.string(), gstin: z.string(), udyam: z.string().optional() });

/**
 * Mock DigiLocker pull. In production the owner authorises DigiLocker via
 * OAuth and we fetch issuer-signed GST/Udyam records, so there is nothing to
 * OCR and nothing to forge. Here we synthesise those records from the
 * registries. Address proof and signatory still come from upload / e-KYC.
 */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  const o = store.getOrder(body.data.orderId);
  if (!o?.consentId) return Response.json({ error: "KYC consent required" }, { status: 403 });

  const g = lookupGstin(body.data.gstin);
  if (!g.record) return Response.json({ error: "No GST record found in DigiLocker for this GSTIN" }, { status: 404 });
  const docs: Record<string, ExtractedDoc> = {
    gst_certificate: {
      docType: "gst_certificate", legible: true, qualityIssues: [], confidence: 1,
      fields: { gstin: g.record.gstin, legalName: g.record.legal_name, tradeName: g.record.trade_name, constitution: g.record.constitution, address: g.record.principal_place_of_business, dateOfLiability: g.record.registration_date },
    },
  };
  const udyamNo = body.data.udyam ?? o.profile.udyam;
  const u = udyamNo ? lookupUdyam(udyamNo) : undefined;
  if (u?.record) {
    docs.udyam_certificate = {
      docType: "udyam_certificate", legible: true, qualityIssues: [], confidence: 1,
      fields: { udyamNumber: u.record.udyam_number, enterpriseName: u.record.enterprise_name, majorActivity: u.record.major_activity, city: u.record.city, state: u.record.state, dateOfRegistration: u.record.date_of_registration },
    };
  }
  // Aadhaar-based e-KYC of the proprietor stands in for a signatory ID upload.
  const person = g.record.legal_name.match(/^(.*?)\s*\(Prop\./i)?.[1];
  if (person) {
    docs.signatory_id = {
      docType: "signatory_id", legible: true, qualityIssues: [], confidence: 1,
      fields: { signatoryName: person, designation: "Proprietor", forBusiness: g.record.trade_name, validTill: new Date(CASE_TODAY.getTime() + 5 * 365 * 86400000).toISOString().slice(0, 10) },
    };
  }
  store.audit("owner", "kyc:digilocker", o.id, Object.keys(docs).join(","));
  return Response.json({ docs, source: "DigiLocker (mock)" });
}
