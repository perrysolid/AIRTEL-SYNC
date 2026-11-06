import { datasets, type GstinRow, type UdyamRow } from "./data";
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
    profile.businessType = lead.business_type;
    profile.segment = segmentFromLabel(lead.segment);
    profile.cityTier = Number(lead.city_tier) as 1 | 2;
    profile.employees = Number(lead.employee_count);
    profile.sites = Number(lead.num_sites);
    profile.currentInternet = INTERNET_FROM_LEAD[lead.current_internet] ?? lead.current_internet;
    profile.currentProvider = lead.current_provider;
    profile.monthlySpend = Number(lead.monthly_telecom_spend_inr);
    profile.language = lead.preferred_language;
    if (lead.udyam_number) profile.udyam = lead.udyam_number;
    known.push("business type", "team size", "number of sites", "current internet", "current spend");
  }
  return { lookup, profile, known };
}
