import { describe, expect, it } from "vitest";
import { datasets } from "./data";
import { gstinCheckChar, repairGstinOcr, validateGstin, validateUdyam } from "./gstin";
import { lookupGstin, profileFromGstin } from "./registry";

describe("GSTIN", () => {
  it("validates every GSTIN in the mock registry", () => {
    const all = [...datasets().gstin.keys()];
    expect(all.length).toBe(3534);
    for (const g of all) expect(validateGstin(g).checksumOk, g).toBe(true);
  });

  it("rejects a GSTIN with one altered digit (K06 specimen)", () => {
    const r = validateGstin("08YKZXS8189L1Z0");
    expect(r.formatOk).toBe(true);
    expect(r.checksumOk).toBe(false);
    expect(gstinCheckChar("08YKZXS8189L1Z")).toBe("I");
  });

  it("repairs OCR confusions using position and checksum", () => {
    expect(repairGstinOcr("27PZSXS193601ZH")).toBe("27PZSXS1936O1ZH"); // 0 in PAN letter slot
    expect(repairGstinOcr("27XUIXGO767D1ZP")).toBe("27XUIXG0767D1ZP"); // O in PAN digit slot
    expect(repairGstinOcr("32TZAXB5481U171")).toBe("32TZAXB5481U1Z1"); // Z read as 7
    expect(repairGstinOcr("19E0GXH4115Y1ZL")).toBe("19EOGXH4115Y1ZL");
  });

  it("does not repair a genuinely altered GSTIN into validity", () => {
    expect(validateGstin(repairGstinOcr("08YKZXS8189L1Z0")).checksumOk).toBe(false);
  });

  it("rejects bad lengths and unknown states", () => {
    expect(validateGstin("27ABC").formatOk).toBe(false);
    expect(validateGstin("99XUIXG0767D1ZP").checksumOk).toBe(false);
  });

  it("recovers a single look-alike letter only via checksum + registry", () => {
    const r = lookupGstin("27QHIXK0658U1ZL"); // OCR read J as I (K10 specimen)
    expect(r.gstin).toBe("27QHJXK0658U1ZL");
    expect(r.ocrCorrected).toBe(true);
    expect(lookupGstin("08YKZXS8189L1Z0").found).toBe(false); // altered digit stays invalid
  });

  it("looks up status from the registry", () => {
    expect(lookupGstin("37IHKXV5167L1ZS").record?.status).toBe("Cancelled");
  });

  it("pre-fills a profile from GSTIN + CRM lead", () => {
    const { profile, known } = profileFromGstin("32TTNXB7384T1ZW");
    expect(profile.businessName).toBe("Balaji Dental Care LLP");
    expect(profile.city).toBe("Kochi");
    expect(profile.cityTier).toBe(2);
    expect(profile.employees).toBe(20);
    expect(profile.segment).toBe("prof");
    expect(known).toContain("team size");
  });
});

describe("Udyam", () => {
  it("validates format and state", () => {
    expect(validateUdyam("UDYAM-KL-00-3078801").formatOk).toBe(true);
    expect(validateUdyam("UDYAM-ZZ-00-3078801").formatOk).toBe(false);
    expect(validateUdyam("12345").formatOk).toBe(false);
  });
});
