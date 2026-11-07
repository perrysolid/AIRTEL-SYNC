import type { ExtractedDoc } from "../kyc-types";
import type { KycDocs } from "../kyc";

/**
 * Ground-truth transcription of the 47 specimen documents (K01-K12), read by
 * hand from the images. Lets us test the KYC rules independently of OCR.
 */

const gst = (gstin: string | null, legalName: string, tradeName: string, constitution: string, address: string, extra: Partial<ExtractedDoc> = {}): ExtractedDoc => ({
  docType: "gst_certificate", legible: true, qualityIssues: [], confidence: 0.95,
  fields: { gstin, legalName, tradeName, constitution, address }, ...extra,
});
const udyam = (udyamNumber: string | null, enterpriseName: string, majorActivity: string, city: string, state: string): ExtractedDoc => ({
  docType: "udyam_certificate", legible: true, qualityIssues: [], confidence: 0.95,
  fields: { udyamNumber, enterpriseName, majorActivity, city, state },
});
const bill = (billedTo: string, address: string, billDate: string): ExtractedDoc => ({
  docType: "address_proof", legible: true, qualityIssues: [], confidence: 0.95,
  fields: { billedTo, address, billDate },
});
const id = (signatoryName: string, designation: string, forBusiness: string, validTill: string): ExtractedDoc => ({
  docType: "signatory_id", legible: true, qualityIssues: [], confidence: 0.95,
  fields: { signatoryName, designation, forBusiness, validTill },
});

export const APPLICANTS: Record<string, KycDocs> = {
  K01: {
    gst_certificate: gst("37IHKXV5167L1ZS", "Neha Kaur (Prop. Vindhya Tours & Travels)", "Vindhya Tours & Travels", "Proprietorship", "Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383"),
    udyam_certificate: udyam(null, "Vindhya Tours & Travels", "Services", "Visakhapatnam", "Andhra Pradesh"),
    address_proof: bill("Vindhya Tours & Travels", "Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383", "2026-06-26"),
    signatory_id: id("Neha Kaur", "Office admin", "Vindhya Tours & Travels", "2028-03-26"),
  },
  K02: {
    gst_certificate: gst("19EOGXH4115Y1ZL", "Joseph Shah (Prop. Harmony Dental Care)", "Harmony Dental Care", "Proprietorship", "Shop/Unit 199, Station Road, Kolkata, West Bengal - 347550", { qualityIssues: ["rotated"] }),
    udyam_certificate: udyam("UDYAM-WB-00-5053330", "Harmony Dental Care", "Services", "Kolkata", "West Bengal"),
    address_proof: bill("Harmony Dental Care", "Shop/Unit 199, Station Road, Kolkata, West Bengal - 347550", "2026-05-22"),
    signatory_id: id("Joseph Shah", "Manager", "Harmony Dental Care", "2028-09-10"),
  },
  K03: {
    gst_certificate: gst("27XUIXG0767D1ZP", "Joseph Singh (Prop. Ganesh Woodcraft)", "Ganesh Woodcraft", "Proprietorship", "Shop/Unit 80, Civil Lines, Nagpur, Maharashtra - 411231"),
    udyam_certificate: udyam("UDYAM-MH-00-9516696", "Ganesh Woodcraft", "Manufacturing", "Nagpur", "Maharashtra"),
    address_proof: bill("Ganesh Woodcraft", "Shop/Unit 80, Civil Lines, Nagpur, Maharashtra - 411231", "2026-05-30"),
    signatory_id: id("Joseph Singh", "Owner", "Ganesh Woodcraft", "2028-07-04"),
  },
  K04: {
    gst_certificate: { docType: "gst_certificate", legible: false, qualityIssues: ["blurred"], confidence: 0.2, fields: {} },
    udyam_certificate: udyam("UDYAM-MH-00-6131836", "Saffron Dental Care LLP", "Services", "Nagpur", "Maharashtra"),
    address_proof: bill("Saffron Dental Care LLP", "Shop/Unit 75, Lake View Colony, Nagpur, Maharashtra - 137452", "2026-05-28"),
    signatory_id: id("Fatima Pillai", "Partner", "Saffron Dental Care LLP", "2028-08-03"),
  },
  K05: {
    gst_certificate: gst("32TZAXB5481U1Z1", "Balaji Realty LLP", "Balaji Realty LLP", "Limited Liability Partnership", "Shop/Unit 38, Civil Lines, Kochi, Kerala - 752083"),
    address_proof: bill("Balaji Realty LLP", "Shop/Unit 38, Civil Lines, Kochi, Kerala - 752083", "2026-06-11"),
    signatory_id: id("Anita Shah", "Owner", "Balaji Realty LLP", "2029-09-11"),
  },
  K06: {
    gst_certificate: gst("08YKZXS8189L1Z0", "Pooja Shah (Prop. Saffron Unisex Salon)", "Saffron Unisex Salon", "Proprietorship", "Shop/Unit 71, Market Yard, Jaipur, Rajasthan - 194057"),
    udyam_certificate: udyam("UDYAM-RJ-00-6577157", "Saffron Unisex Salon", "Services", "Jaipur", "Rajasthan"),
    address_proof: bill("Saffron Unisex Salon", "Shop/Unit 71, Market Yard, Jaipur, Rajasthan - 194057", "2026-06-11"),
    signatory_id: id("Pooja Shah", "Owner", "Saffron Unisex Salon", "2028-09-15"),
  },
  K07: {
    gst_certificate: gst("07CPCXN0398P1ZT", "Neha Banerjee (Prop. Shri Physio Clinic)", "Neelgiri Physio Clinic", "Proprietorship", "Shop/Unit 52, Transport Nagar, Delhi, Delhi - 334596"),
    udyam_certificate: udyam("UDYAM-DL-00-9565547", "Neelgiri Physio Clinic", "Services", "Delhi", "Delhi"),
    address_proof: bill("Neelgiri Physio Clinic", "Shop/Unit 52, Transport Nagar, Delhi, Delhi - 334596", "2026-07-05"),
    signatory_id: id("Neha Banerjee", "Manager", "Neelgiri Physio Clinic", "2030-05-05"),
  },
  K08: {
    gst_certificate: gst("24XORXG9365M1Z3", "Joseph Rao (Prop. Green Leaf Legal Associates)", "Green Leaf Legal Associates", "Proprietorship", "Shop/Unit 238, Ring Road, Vadodara, Gujarat - 348176"),
    udyam_certificate: udyam("UDYAM-GJ-00-8477445", "Green Leaf Legal Associates", "Services", "Vadodara", "Gujarat"),
    address_proof: bill("Green Leaf Legal Associates", "Shop/Unit 238, Ring Road, Vadodara, Gujarat - 348176", "2026-05-26"),
    signatory_id: id("Joseph Rao", "Office admin", "Green Leaf Legal Associates", "2027-09-18"),
  },
  K09: {
    gst_certificate: gst("37LDYXK0296F1ZB", "Anita Kulkarni (Prop. Kaveri Insurance Advisors)", "Kaveri Insurance Advisors", "Proprietorship", "Shop/Unit 217, Civil Lines, Visakhapatnam, Andhra Pradesh - 405337"),
    udyam_certificate: udyam("UDYAM-AP-00-9751562", "Kaveri Insurance Advisors", "Services", "Visakhapatnam", "Andhra Pradesh"),
    address_proof: bill("Kaveri Insurance Advisors", "Shop/Unit 217, Civil Lines, Visakhapatnam, Andhra Pradesh - 405337", "2026-07-10"),
    signatory_id: id("Anita Kulkarni", "Office admin", "Kaveri Insurance Advisors", "2027-12-22"),
  },
  K10: {
    gst_certificate: gst("27QHJXK0658U1ZL", "Kaveri Stays LLP", "Kaveri Stays LLP", "Limited Liability Partnership", "Shop/Unit 21, Sector 14, Mumbai, Maharashtra - 570043"),
    udyam_certificate: udyam("UDYAM-MH-00-7183141", "Kaveri Stays LLP", "Services", "Mumbai", "Maharashtra"),
    address_proof: bill("Kaveri Stays LLP", "Shop/Unit 21, Sector 14, Mumbai, Maharashtra - 570043", "2026-06-18"),
    signatory_id: id("Nisha Arora", "Owner", "Kaveri Stays LLP", "2029-06-01"),
  },
  K11: {
    gst_certificate: gst("03KGZXT1320R1ZZ", "Trinity Bake House Pvt Ltd", "Trinity Bake House Pvt Ltd", "Private Limited Company", "Shop/Unit 188, Industrial Area Phase 2, Ludhiana, Punjab - 541498"),
    udyam_certificate: udyam("UDYAM-PB-00-9719478", "Trinity Bake House Pvt Ltd", "Services", "Ludhiana", "Punjab"),
    address_proof: bill("Trinity Bake House Pvt Ltd", "Shop/Unit 188, Industrial Area Phase 2, Ludhiana, Punjab - 541498", "2025-10-31"),
    signatory_id: id("Vikram Pillai", "Owner", "Trinity Bake House Pvt Ltd", "2028-12-23"),
  },
  K12: {
    gst_certificate: gst("37NBLXS1145E1ZU", "Pooja Agarwal (Prop. Star Electronics)", "Star Electronics", "Proprietorship", "Shop/Unit 216, Nehru Nagar, Visakhapatnam, Andhra Pradesh - 762071"),
    udyam_certificate: udyam("UDYAM-AP-00-5186772", "Star Electronics", "Services", "Visakhapatnam", "Andhra Pradesh"),
    address_proof: bill("Star Electronics", "Shop/Unit 216, Nehru Nagar, Visakhapatnam, Andhra Pradesh - 762071", "2026-07-06"),
    signatory_id: id("Pooja Agarwal", "Owner", "Star Electronics", "2029-03-03"),
  },
};

/** Our answer key: the planted problem(s) we expect each applicant to surface. */
export const EXPECTED: Record<string, { verdict: "verified" | "needs_attention" | "rejected"; mustFail?: string[]; mustWarn?: string[] }> = {
  K01: { verdict: "rejected", mustFail: ["gstin_status", "udyam_number_missing"] },
  K02: { verdict: "verified" },
  K03: { verdict: "verified" },
  K04: { verdict: "needs_attention", mustFail: ["gst_certificate_illegible"] },
  K05: { verdict: "verified", mustWarn: ["udyam_missing", "signatory_authority"] },
  K06: { verdict: "rejected", mustFail: ["gstin_checksum"] },
  K07: { verdict: "rejected", mustFail: ["gst_name_registry"] },
  K08: { verdict: "verified" },
  K09: { verdict: "verified" },
  K10: { verdict: "verified", mustWarn: ["signatory_authority"] },
  K11: { verdict: "needs_attention", mustFail: ["address_date"], mustWarn: ["signatory_authority"] },
  K12: { verdict: "verified" },
};
