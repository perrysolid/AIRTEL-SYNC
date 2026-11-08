import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, datasets, type LeadRow } from "./data";

/** Funnel analytics + propensity scoring for the partner/sales console. */

interface Model {
  auc: number;
  lift_top_decile: number;
  top_decile_activation: number;
  base_activation: number;
  intercept: number;
  features: { name: string; mean: number; std: number; coef: number }[];
  calibration: { a: number; b: number };
}

let model: Model | undefined;
export function propensityModel(): Model {
  model ??= JSON.parse(fs.readFileSync(path.join(DATA_DIR, "propensity_model.json"), "utf8")) as Model;
  return model;
}

const CAT = ["lead_source", "segment", "city_tier", "preferred_language", "annual_turnover_band", "has_gstin", "has_udyam", "current_internet", "current_provider"] as const;

function featureValue(lead: LeadRow, name: string): number {
  if (name.startsWith("log_")) {
    const col = name.slice(4);
    const v = col === "n_products_of_interest" ? lead.products_of_interest.split(";").filter(Boolean).length : Number(lead[col as keyof LeadRow]);
    return Math.log1p(v || 0);
  }
  const [col, val] = name.split("=");
  return CAT.includes(col as (typeof CAT)[number]) && String(lead[col as keyof LeadRow]) === val ? 1 : 0;
}

const READABLE: Record<string, string> = {
  "has_gstin=Y": "Has GSTIN",
  "has_gstin=N": "No GSTIN",
  "lead_source=Referral": "Came by referral",
  "lead_source=WhatsApp campaign": "WhatsApp campaign lead",
  "lead_source=Website form": "Website form lead",
  "lead_source=Inbound call": "Called us",
  "segment=Micro retail & services": "Micro retail",
  "segment=Small manufacturers": "Manufacturer",
  "segment=Small multi-site businesses": "Multi-site",
  "segment=Professional offices": "Professional office",
  "current_internet=Mobile hotspot": "On mobile hotspot today",
  "current_internet=Leased line": "Already on leased line",
  "has_udyam=Y": "Udyam registered",
  "annual_turnover_band=< 40 lakh": "Turnover < ₹40L",
  "annual_turnover_band=5 - 25 cr": "Turnover ₹5-25 cr",
  "city_tier=1": "Tier-1 city",
  "city_tier=2": "Tier-2 city",
};

export interface Score {
  probability: number;
  band: "hot" | "warm" | "cold";
  reasons: { label: string; effect: number }[];
}

export function scoreLead(lead: LeadRow): Score {
  const m = propensityModel();
  let z = m.intercept;
  const contrib: { name: string; effect: number }[] = [];
  for (const f of m.features) {
    const x = (featureValue(lead, f.name) - f.mean) / f.std;
    const e = x * f.coef;
    z += e;
    if (featureValue(lead, f.name) !== 0 && !f.name.startsWith("log_")) contrib.push({ name: f.name, effect: e });
  }
  const pRaw = 1 / (1 + Math.exp(-z));
  const logit = Math.log(pRaw / (1 - pRaw));
  const probability = 1 / (1 + Math.exp(-(m.calibration.a * logit + m.calibration.b)));
  const reasons = contrib
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .slice(0, 3)
    .map((c) => ({ label: READABLE[c.name] ?? readable(c.name), effect: c.effect }));
  const band = probability >= 0.15 ? "hot" : probability >= 0.07 ? "warm" : "cold";
  return { probability, band, reasons };
}

/** "lead_source=Channel partner" → "Channel partner lead", for features without a hand-written label. */
function readable(name: string) {
  const [col, val] = name.split("=");
  if (col === "lead_source") return `${val} lead`;
  if (col === "current_internet") return `On ${val.toLowerCase()} today`;
  if (col === "current_provider") return val === "None" ? "No provider today" : `With ${val} today`;
  if (col === "preferred_language") return `Speaks ${val}`;
  if (col === "annual_turnover_band") return `Turnover ${val}`;
  if (col === "segment") return val;
  return val ?? name;
}

const STAGES = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"];

let cachedSummary: ReturnType<typeof computeSummary> | undefined;
export function leadSummary() {
  cachedSummary ??= computeSummary();
  return cachedSummary;
}

function computeSummary() {
  const leads = datasets().leads;
  const reached = (l: LeadRow) => STAGES.indexOf(l.stage_reached);
  const funnel = STAGES.map((s, i) => ({ stage: s, count: leads.filter((l) => reached(l) >= i).length }));
  const activated = leads.filter((l) => l.outcome === "Activated");
  const totalCac = leads.reduce((s, l) => s + Number(l.acquisition_cost_inr || 0), 0);

  const groupBy = (key: keyof LeadRow) => {
    const m = new Map<string, LeadRow[]>();
    for (const l of leads) m.set(l[key], [...(m.get(l[key]) ?? []), l]);
    return [...m.entries()].map(([k, ls]) => {
      const act = ls.filter((l) => l.outcome === "Activated");
      const cac = ls.reduce((s, l) => s + Number(l.acquisition_cost_inr || 0), 0);
      const churned = act.filter((l) => l.churned_within_6_months === "Y").length;
      return {
        key: k,
        leads: ls.length,
        activation: act.length / ls.length,
        cacPerActivation: act.length ? cac / act.length : null,
        avgBundle: act.length ? act.reduce((s, l) => s + Number(l.monthly_bundle_value_inr), 0) / act.length : null,
        churn: act.length ? churned / act.length : null,
      };
    }).sort((a, b) => b.leads - a.leads);
  };

  const drops = new Map<string, { stage: string; reason: string; count: number }>();
  for (const l of leads) {
    if (l.outcome !== "Dropped") continue;
    const k = `${l.stage_reached}|${l.drop_reason}`;
    drops.set(k, { stage: l.stage_reached, reason: l.drop_reason, count: (drops.get(k)?.count ?? 0) + 1 });
  }

  const byCalls = [1, 2, 3, 4, 5].map((n) => {
    const g = activated.filter((l) => Number(l.customer_follow_up_calls) === n);
    return { calls: n, customers: g.length, churn: g.length ? g.filter((l) => l.churned_within_6_months === "Y").length / g.length : 0 };
  });

  return {
    funnel,
    activated: activated.length,
    activationRate: activated.length / leads.length,
    avgDaysToActivate: activated.reduce((s, l) => s + Number(l.days_lead_to_activation), 0) / activated.length,
    avgChaseCalls: activated.reduce((s, l) => s + Number(l.customer_follow_up_calls), 0) / activated.length,
    cacPerActivation: totalCac / activated.length,
    churn6m: activated.filter((l) => l.churned_within_6_months === "Y").length / activated.length,
    bySource: groupBy("lead_source"),
    bySegment: groupBy("segment"),
    byLanguage: groupBy("preferred_language"),
    dropReasons: [...drops.values()].sort((a, b) => b.count - a.count),
    churnByChaseCalls: byCalls,
    model: { auc: propensityModel().auc, lift: propensityModel().lift_top_decile },
  };
}

/** Leads still worth a call (dropped early for recoverable reasons), ranked by propensity. */
export function callList(limit = 50) {
  const recoverable = /no time|not scheduled|took too long|too complex|decided to wait|paperwork|signatory|missing gst|unreachable/i;
  return datasets()
    .leads.filter((l) => l.outcome === "Dropped" && recoverable.test(l.drop_reason))
    .map((l) => ({ lead: l, score: scoreLead(l) }))
    .sort((a, b) => b.score.probability - a.score.probability)
    .slice(0, limit);
}
