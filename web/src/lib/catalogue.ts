import { datasets } from "./data";

export type SegmentKey = "micro" | "prof" | "multi" | "mfg";

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  micro: "Micro retail & services",
  prof: "Professional offices",
  multi: "Small multi-site businesses",
  mfg: "Small manufacturers",
};

export function segmentFromLabel(label: string): SegmentKey | undefined {
  return (Object.keys(SEGMENT_LABELS) as SegmentKey[]).find((k) => SEGMENT_LABELS[k] === label);
}

export interface Product {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  priceMin: number;
  priceMax: number;
  setupFee: number;
  minContract: number;
  tiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  requiresOneOf: string[];
  installDays: number;
  segments: SegmentKey[];
}

let cache: Map<string, Product> | undefined;

export function catalogue(): Map<string, Product> {
  if (!cache) {
    cache = new Map(
      datasets().catalogue.map((r) => [
        r.product_id,
        {
          id: r.product_id,
          category: r.category,
          name: r.product_name,
          description: r.description,
          unit: r.unit,
          priceMin: Number(r.price_min_inr_per_month),
          priceMax: Number(r.price_max_inr_per_month),
          setupFee: Number(r.one_time_setup_inr),
          minContract: Number(r.min_contract_months),
          tiers: r.available_city_tiers.split(";").map(Number),
          minEmployees: Number(r.min_employees),
          minSites: Number(r.min_sites),
          requiresGstin: r.requires_gstin === "Y",
          requiresOneOf: r.requires_one_of ? r.requires_one_of.split("|") : [],
          installDays: Number(r.typical_install_days),
          segments: r.target_segments.split(";") as SegmentKey[],
        },
      ]),
    );
  }
  return cache;
}

export function product(id: string): Product {
  const p = catalogue().get(id);
  if (!p) throw new Error(`Unknown product ${id}`);
  return p;
}

/** Products that count as a primary internet link for dependency rules. */
export const PRIMARY_LINKS = ["P01", "P02", "P03", "P04", "P05", "P06"];
