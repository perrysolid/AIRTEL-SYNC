import { datasets, type GstinRow, type LeadRow, type UdyamRow } from "./data";
import { segmentFromLabel } from "./catalogue";
import { repairGstinOcr, validateGstin, validateUdyam } from "./gstin";
import type { Profile } from "./profile";

/** Mock government registry APIs backed by the hackathon CSVs. */

export interface GstinLookup {
  found: boolean;
  gstin: string;
  check: ReturnType<typeof validateGstin>;
  record?: GstinRow;
}

// Letters OCR commonly confuses with each other (digit confusions are handled positionally).
const LOOKALIKE: Record<string, string[]> = {
  I: ["J", "L", "T"], J: ["I"], L: ["I"], T: ["I"], O: ["Q", "D"], Q: ["O"], D: ["O"],
  U: ["V"], V: ["U"], M: ["N"], N: ["M"], E: ["F"], F: ["E"], C: ["G"], G: ["C"],
};

export function lookupGstin(raw: string): GstinLookup & { ocrCorrected?: boolean } {
  const repaired = repairGstinOcr(raw);
  const check = validateGstin(repaired);
  const record = check.formatOk ? datasets().gstin.get(check.normalized) : undefined;
  if (record || !check.formatOk || check.checksumOk) return { found: !!record, gstin: check.normalized, check, record };

  // One look-alike letter misread: accept only if the swap passes the checksum
  // AND exists in the registry. A deliberately altered digit stays invalid.
  const s = check.normalized;
  for (let i = 2; i < 15; i++) {
    for (const alt of LOOKALIKE[s[i]] ?? []) {
      const candidate = s.slice(0, i) + alt + s.slice(i + 1);
      const c = validateGstin(candidate);
      const r = c.checksumOk ? datasets().gstin.get(candidate) : undefined;
      if (r) return { found: true, gstin: candidate, check: c, record: r, ocrCorrected: true };
    }
  }
  return { found: false, gstin: s, check, record };
}

export interface UdyamLookup {
  found: boolean;
  udyam: string;
  check: ReturnType<typeof validateUdyam>;
  record?: UdyamRow;
}

export function lookupUdyam(raw: string): UdyamLookup {
  const check = validateUdyam(raw);
  const record = check.formatOk ? datasets().udyam.get(check.normalized) : undefined;
  return { found: !!record, udyam: check.normalized, check, record };
}

const INTERNET_FROM_LEAD: Record<string, string> = {
  "Mobile hotspot": "Mobile hotspot",
  "Home broadband": "Home broadband",
  "Business broadband": "Business broadband",
  "Leased line": "Leased line",
  "Mixed per site": "Different ISPs per site",
};

/**
 * "One sitting" pre-fill: from a GSTIN we pull the registry record and, when
 * the business is already a known lead, the profile our CRM holds — so the
 * owner only answers what we genuinely don't know.
 */
export function profileFromGstin(raw: string): { lookup: GstinLookup; profile: Partial<Profile>; known: string[] } {
  const lookup = lookupGstin(raw);
  const profile: Partial<Profile> = {};
  const known: string[] = [];
  if (!lookup.found || !lookup.record) return { lookup, profile, known };
  const r = lookup.record;
  profile.gstin = r.gstin;
  profile.hasGstin = true;
  profile.gstinActive = r.status === "Active";
  profile.businessName = r.trade_name;
  profile.state = r.state;
  known.push("business name", "state", "GST status");
  const cityMatch = r.principal_place_of_business.match(/,\s*([A-Za-z ]+),\s*[A-Za-z ]+\s*-\s*\d{6}$/);
  if (cityMatch) {
    profile.city = cityMatch[1].trim();
    known.push("city");
  }
  const lead = datasets().leadsByGstin.get(r.gstin);
  if (lead) {
    Object.assign(profile, leadFacts(lead));
    known.push("business type", "team size", "number of sites", "current internet", "current spend");
  }
  return { lookup, profile, known };
}

/** What the CRM already knows about a lead, as advisor profile facts. */
function leadFacts(lead: LeadRow): Partial<Profile> {
  return {
    businessType: lead.business_type,
    segment: segmentFromLabel(lead.segment),
    cityTier: Number(lead.city_tier) as 1 | 2,
    employees: Number(lead.employee_count),
    sites: Number(lead.num_sites),
    currentInternet: INTERNET_FROM_LEAD[lead.current_internet] ?? lead.current_internet,
    currentProvider: lead.current_provider,
    monthlySpend: Number(lead.monthly_telecom_spend_inr),
    language: lead.preferred_language,
    ...(lead.udyam_number ? { udyam: lead.udyam_number } : {}),
  };
}

/** A win-back link (lead code like L00042) pre-fills the advisor from the CRM. */
export function profileFromLead(leadId: string): { lead: LeadRow; profile: Partial<Profile> } | undefined {
  const lead = datasets().leadsById.get(leadId.toUpperCase());
  if (!lead) return undefined;
  const profile: Partial<Profile> = {
    ...leadFacts(lead),
    businessName: lead.business_name,
    city: lead.city,
    state: lead.state,
    hasGstin: lead.has_gstin === "Y",
    ...(lead.gstin ? { gstin: lead.gstin, gstinActive: lookupGstin(lead.gstin).record?.status === "Active" } : {}),
    needs: [],
  };
  return { lead, profile };
}

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/\(prop\.?[^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const pinOf = (s?: string | null) => (s ?? "").replace(/\s+/g, "").match(/(\d{6})(?!.*\d)/)?.[1];

/**
 * Reverse lookup for when the number itself is unreadable or missing. Trade
 * names repeat across the registry (hundreds of "Saffron Dental Care"s), so a
 * name alone never decides: it must also match the location, and exactly one
 * record may survive.
 */
export function findGstinByBusiness(names: (string | null | undefined)[], addressPin?: string): GstinRow | undefined {
  const wanted = new Set(names.map(norm).filter(Boolean));
  if (!wanted.size || !addressPin) return undefined;
  const hits = [...datasets().gstin.values()].filter((r) => (wanted.has(norm(r.trade_name)) || wanted.has(norm(r.legal_name))) && pinOf(r.principal_place_of_business) === addressPin);
  return hits.length === 1 ? hits[0] : undefined;
}

export function findUdyamByBusiness(names: (string | null | undefined)[], state?: string, city?: string): UdyamRow | undefined {
  const wanted = new Set(names.map(norm).filter(Boolean));
  if (!wanted.size || !state) return undefined;
  const hits = [...datasets().udyam.values()].filter((r) => wanted.has(norm(r.enterprise_name)) && r.state === state && (!city || r.city === city));
  return hits.length === 1 ? hits[0] : undefined;
}

export { pinOf };
