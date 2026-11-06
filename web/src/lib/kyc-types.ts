import { z } from "zod";

/** Shapes shared by the extractor (OCR / vision) and the KYC rule engine. */

export const DOC_TYPES = ["gst_certificate", "udyam_certificate", "address_proof", "signatory_id"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_LABELS: Record<DocType, string> = {
  gst_certificate: "GST certificate",
  udyam_certificate: "Udyam certificate",
  address_proof: "Address proof (utility bill)",
  signatory_id: "Authorised signatory ID",
};

const opt = z.string().nullable().optional();

export const ExtractedDocSchema = z.object({
  docType: z.enum([...DOC_TYPES, "unknown"]),
  /** False when the image is too blurred/cropped to trust. */
  legible: z.boolean(),
  qualityIssues: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.9),
  fields: z
    .object({
      gstin: opt,
      legalName: opt,
      tradeName: opt,
      constitution: opt,
      address: opt,
      dateOfLiability: opt,
      udyamNumber: opt,
      enterpriseName: opt,
      majorActivity: opt,
      city: opt,
      state: opt,
      dateOfRegistration: opt,
      consumerNumber: opt,
      billedTo: opt,
      billDate: opt,
      signatoryName: opt,
      designation: opt,
      forBusiness: opt,
      idNumber: opt,
      validTill: opt,
    })
    .default({}),
});
export type ExtractedDoc = z.infer<typeof ExtractedDocSchema>;

export type CheckStatus = "pass" | "warn" | "fail";

export interface KycCheck {
  id: string;
  doc: DocType | "cross";
  status: CheckStatus;
  title: string;
  detail: string;
  /** What the owner should do, in plain words. */
  fix?: string;
}

export type KycVerdict = "verified" | "needs_attention" | "rejected";

export interface KycResult {
  verdict: KycVerdict;
  checks: KycCheck[];
  summary: string;
  /** Owner-facing actions, de-duplicated. */
  actions: string[];
}
