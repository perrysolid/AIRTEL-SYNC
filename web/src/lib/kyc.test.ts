import { describe, expect, it } from "vitest";
import { validateKyc, nameSimilarity, splitLegalName } from "./kyc";
import { APPLICANTS, EXPECTED } from "./__fixtures__/kyc-applicants";

describe("KYC answer key (K01-K12)", () => {
  for (const [k, docs] of Object.entries(APPLICANTS)) {
    const exp = EXPECTED[k];
    it(`${k} -> ${exp.verdict}`, () => {
      const r = validateKyc(docs);
      const failed = r.checks.filter((c) => c.status === "fail").map((c) => c.id);
      const warned = r.checks.filter((c) => c.status === "warn").map((c) => c.id);
      expect(r.verdict, JSON.stringify(r.checks.filter((c) => c.status !== "pass"), null, 1)).toBe(exp.verdict);
      for (const id of exp.mustFail ?? []) expect(failed).toContain(id);
      for (const id of exp.mustWarn ?? []) expect(warned).toContain(id);
    });
  }

  it("every non-pass check tells the owner what to do or is informational", () => {
    for (const docs of Object.values(APPLICANTS)) {
      for (const c of validateKyc(docs).checks) {
        if (c.status === "fail") expect(c.fix, c.id).toBeTruthy();
      }
    }
  });

  it("flags expired signatory IDs", () => {
    const docs = structuredClone(APPLICANTS.K03);
    docs.signatory_id!.fields.validTill = "2026-01-01";
    expect(validateKyc(docs).checks.find((c) => c.id === "signatory_expired")?.status).toBe("fail");
  });

  it("requires GST, address proof and signatory ID", () => {
    const r = validateKyc({});
    expect(r.verdict).toBe("needs_attention");
    expect(r.checks.map((c) => c.id)).toEqual(expect.arrayContaining(["gst_certificate_missing", "address_proof_missing", "signatory_id_missing"]));
  });
});

describe("registry recovery", () => {
  const detail = (k: string, id: string) => validateKyc(APPLICANTS[k]).checks.find((c) => c.id === id);
  it("K04: finds the blurred GSTIN from business name + bill PIN", () => {
    expect(detail("K04", "gstin_suggested")?.detail).toContain("27PZSXS1936O1ZH");
  });
  it("K05: finds the missing Udyam number from the GST record", () => {
    expect(detail("K05", "udyam_suggested")?.detail).toContain("UDYAM-KL-00-5521886");
  });
  it("K01: does not suggest a same-name Udyam from another state", () => {
    expect(detail("K01", "udyam_suggested")).toBeUndefined();
  });
  it("never suggests when the name is ambiguous at that location", () => {
    expect(validateKyc({ address_proof: { ...APPLICANTS.K04.address_proof!, fields: { billedTo: "Saffron Dental Care", address: "Nagpur - 999999", billDate: "2026-06-01" } } }).checks.find((c) => c.id === "gstin_suggested")).toBeUndefined();
  });
});

describe("name helpers", () => {
  it("splits proprietorship legal names", () => {
    expect(splitLegalName("Neha Kaur (Prop. Vindhya Tours & Travels)")).toEqual({ person: "Neha Kaur", firm: "Vindhya Tours & Travels" });
  });
  it("ignores legal suffixes and word order", () => {
    expect(nameSimilarity("Balaji Realty LLP", "BALAJI REALTY")).toBe(1);
    expect(nameSimilarity("Saffron Dental Care", "Harmony Dental Care")).toBeLessThan(0.8);
  });
});
