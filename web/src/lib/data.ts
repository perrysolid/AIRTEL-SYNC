import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

/**
 * Loads the synthetic hackathon datasets once per server process.
 * All files live in web/data so the app deploys as a single unit.
 */

export const DATA_DIR = path.join(process.cwd(), "data");

/** The case fixes "today" for all date-based checks (README: use 2026-07-15). */
export const CASE_TODAY = new Date("2026-07-15T00:00:00+05:30");

function readCsv<T>(file: string): T[] {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  const parsed = Papa.parse<T>(raw, { header: true, skipEmptyLines: true });
  return parsed.data;
}

export interface CatalogueRow {
  product_id: string;
  category: string;
  product_name: string;
  description: string;
  unit: string;
  price_min_inr_per_month: string;
  price_max_inr_per_month: string;
  one_time_setup_inr: string;
  min_contract_months: string;
  available_city_tiers: string;
  min_employees: string;
  min_sites: string;
  requires_gstin: string;
  requires_one_of: string;
  typical_install_days: string;
  target_segments: string;
}

export interface GstinRow {
  gstin: string;
  legal_name: string;
  trade_name: string;
  constitution: string;
  principal_place_of_business: string;
  state: string;
  registration_date: string;
  status: "Active" | "Cancelled" | "Suspended";
}

export interface UdyamRow {
  udyam_number: string;
  enterprise_name: string;
  enterprise_type: string;
  major_activity: string;
  nic_description: string;
  state: string;
  city: string;
  date_of_registration: string;
}

export interface LeadRow {
  lead_id: string;
  created_date: string;
  lead_source: string;
  business_name: string;
  business_type: string;
  segment: string;
  city: string;
  city_tier: string;
  state: string;
  preferred_language: string;
  employee_count: string;
  num_sites: string;
  annual_turnover_band: string;
  has_gstin: string;
  gstin: string;
  has_udyam: string;
  udyam_number: string;
  current_internet: string;
  current_provider: string;
  monthly_telecom_spend_inr: string;
  products_of_interest: string;
  contact_name: string;
  contact_role: string;
  stage_reached: string;
  outcome: string;
  drop_reason: string;
  contacted_date: string;
  needs_assessed_date: string;
  quote_accepted_date: string;
  kyc_complete_date: string;
  activated_date: string;
  days_lead_to_activation: string;
  customer_follow_up_calls: string;
  bundle_products: string;
  monthly_bundle_value_inr: string;
  one_time_setup_inr: string;
  contract_months: string;
  churned_within_6_months: string;
  nps_score: string;
  acquisition_cost_inr: string;
}

interface Datasets {
  catalogue: CatalogueRow[];
  gstin: Map<string, GstinRow>;
  udyam: Map<string, UdyamRow>;
  leads: LeadRow[];
  leadsByGstin: Map<string, LeadRow>;
}

const g = globalThis as unknown as { __udyamData?: Datasets };

export function datasets(): Datasets {
  if (!g.__udyamData) {
    const leads = readCsv<LeadRow>("smb_leads.csv");
    g.__udyamData = {
      catalogue: readCsv<CatalogueRow>("product_catalogue.csv"),
      gstin: new Map(readCsv<GstinRow>("mock_gstin_registry.csv").map((r) => [r.gstin, r])),
      udyam: new Map(readCsv<UdyamRow>("mock_udyam_registry.csv").map((r) => [r.udyam_number, r])),
      leads,
      leadsByGstin: new Map(leads.filter((l) => l.gstin).map((l) => [l.gstin, l])),
    };
  }
  return g.__udyamData;
}
