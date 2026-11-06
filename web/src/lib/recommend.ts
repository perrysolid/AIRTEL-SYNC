import { PRIMARY_LINKS, product, type Product, type SegmentKey } from "./catalogue";
import { inferSegment, type Need, type Profile } from "./profile";

/**
 * Deterministic bundle engine. The LLM advisor gathers facts and explains;
 * this module alone decides which products are eligible and what they cost,
 * so the advisor can never quote an ineligible product or a made-up price.
 */

export interface BundleLine {
  productId: string;
  qty: number;
  /** Optional add-ons start switched off in the quote; the owner can toggle them. */
  optional: boolean;
  reason: string;
}

export interface Exclusion {
  productId: string;
  reason: string;
  alternative?: string;
}

export interface Recommendation {
  segment: SegmentKey;
  lines: BundleLine[];
  excluded: Exclusion[];
  notes: string[];
  assumptions: string[];
}

export interface EligibilityResult {
  ok: boolean;
  reasons: string[];
}

/** Checks one product against the catalogue rules for this business. */
export function checkEligibility(p: Product, profile: Profile, bundleIds: string[] = []): EligibilityResult {
  const reasons: string[] = [];
  if (profile.cityTier && !p.tiers.includes(profile.cityTier)) {
    reasons.push(`${p.name} is only sold in tier ${p.tiers.join("/")} cities`);
  }
  if ((profile.employees ?? 1) < p.minEmployees) {
    reasons.push(`${p.name} needs at least ${p.minEmployees} employees`);
  }
  if ((profile.sites ?? 1) < p.minSites) {
    reasons.push(`${p.name} needs at least ${p.minSites} sites`);
  }
  if (p.requiresGstin) {
    if (!profile.hasGstin) reasons.push(`${p.name} needs a GSTIN`);
    else if (profile.gstinActive === false) reasons.push(`${p.name} needs an active GSTIN (yours is not active)`);
  }
  if (p.requiresOneOf.length && !p.requiresOneOf.some((id) => bundleIds.includes(id))) {
    const names = p.requiresOneOf.map((id) => product(id).name).join(" / ");
    reasons.push(`${p.name} works only with one of: ${names}`);
  }
  return { ok: reasons.length === 0, reasons };
}

const ALTERNATIVES: Record<string, (profile: Profile) => string | undefined> = {
  P03: () => "Biz Fibre 300 (P02) gives 300 Mbps and is available in your city",
  P05: (pr) =>
    pr.hasGstin === false
      ? "Biz Fibre 300 (P02) + Backup Failover (P09) until your GSTIN is registered"
      : "Biz Fibre 300 (P02) + Backup Failover (P09) gives near-leased-line uptime for your size",
  P06: () => "Internet Leased Line 20 (P05) if you have 10+ employees, otherwise Biz Fibre 1G/300",
  P10: () => "Backup 4G/5G Failover (P09) at each site, managed from one bill",
  P12: () => "Business Postpaid lines (P07) for staff calling",
  P13: () => "A Business Postpaid number (P07) shown as your business line",
  P14: () => "Register for GST (we can guide you); meanwhile use the free WhatsApp Business app",
  P15: () => "Register for GST (we can guide you); meanwhile use the free WhatsApp Business app",
  P21: () => "Endpoint Security (P20) on each device plus Secure Wi-Fi (P22)",
  P24: () => "Fleet Tracker style IoT SIMs (P25) need no minimum size; machine kits need 10+ employees",
  P11: () => "Static IP works on fibre plans (P01-P03); ask for fibre feasibility at your site",
};

const NEED_TO_PRODUCT: Partial<Record<Need, string>> = {
  backup_internet: "P09",
  mobile_lines: "P07",
  whatsapp: "P15",
  sms: "P14",
  website: "P18",
  email: "P16",
  cloud_backup: "P17",
  pos_billing: "P19",
  device_security: "P20",
  firewall: "P21",
  guest_wifi: "P22",
  cctv: "P23",
  business_phone: "P12",
  toll_free: "P13",
  static_ip: "P11",
  multi_site_management: "P10",
  machine_monitoring: "P24",
  fleet_tracking: "P25",
};

const SUGGESTIONS: Record<SegmentKey, string[]> = {
  micro: ["P19", "P15", "P23", "P22", "P18"],
  prof: ["P09", "P20", "P16", "P17"],
  multi: ["P09", "P23", "P10", "P21"],
  mfg: ["P21", "P09", "P24", "P11"],
};

function reasonFor(id: string, seg: SegmentKey, pr: Profile): string {
  const sites = pr.sites ?? 1;
  switch (id) {
    case "P01": return "100 Mbps fibre is plenty for UPI, billing and a few devices";
    case "P02": return sites > 1 ? `300 Mbps fibre at each of your ${sites} sites` : "300 Mbps fibre for a busy office with several users";
    case "P03": return "1 Gbps fibre with priority support for heavy cloud use";
    case "P04": return "5G AirFiber needs no cabling — plug in and it's live in about 2 days";
    case "P05": return "A dedicated leased line with 99.5% uptime SLA for your operations";
    case "P06": return "100 Mbps dedicated line with 99.9% SLA for a large plant";
    case "P07": return "Business mobile numbers with one bill instead of personal SIMs";
    case "P08": return "Higher-data lines with roaming for managers who travel";
    case "P09": return "Keeps you online automatically if the main line goes down";
    case "P10": return "Manage the internet at every branch from one dashboard";
    case "P11": return "A fixed IP so cameras or servers can be reached remotely";
    case "P12": return "Office phone lines with IVR and call recording over the internet";
    case "P13": return "An 1800 number customers can call for free";
    case "P14": return "10,000 SMS a month for reminders and offers";
    case "P15": return "Verified WhatsApp with catalogue to take orders and send updates";
    case "P16": return "Email on your own domain with documents and video meetings";
    case "P17": return "Automatic backup so patient/client data is never lost";
    case "P18": return "A simple website so customers can find you on Google";
    case "P19": return "GST-ready billing with UPI/card payments on a tablet";
    case "P20": return "Protects PCs and phones from viruses and ransomware";
    case "P21": return "A managed firewall watched by Accel's security team";
    case "P22": return seg === "micro" ? "Separate free Wi-Fi for customers, keeping your billing network safe" : "Secure staff Wi-Fi with a separate guest network";
    case "P23": return "HD cameras with 30-day cloud recording, viewable on your phone";
    case "P24": return "Sensors that alert you when a machine stops or overuses power";
    case "P25": return "Live GPS tracking for your delivery vehicles";
    default: return "";
  }
}

function defaultQty(id: string, seg: SegmentKey, pr: Profile, assumptions: string[]): number {
  const sites = pr.sites ?? 1;
  const emp = pr.employees ?? 1;
  const assume = (n: number, what: string) => {
    assumptions.push(`Assumed ${n} ${what} — change it in the quote`);
    return n;
  };
  const p = product(id);
  if (p.unit === "per site") return sites;
  switch (id) {
    case "P07": return pr.mobileLines ?? assume(seg === "micro" ? Math.min(2, emp) : Math.min(Math.max(2, Math.ceil(emp / 3)), 20), "mobile line(s)");
    case "P16": return pr.emailUsers ?? assume(seg === "micro" ? 1 : Math.min(emp, 25), "email user(s)");
    case "P20": return pr.devices ?? assume(Math.max(1, Math.min(Math.round(emp * 0.6), 50)), "device(s) to protect");
    case "P19": return pr.counters ?? assume(sites, "billing counter(s)");
    case "P23": return pr.cameras ?? assume(2 * sites, "camera(s)");
    case "P25": return pr.vehicles ?? assume(2, "vehicle(s)");
    case "P24": return pr.machines ?? assume(3, "machine(s)");
    case "P12": return assume(Math.min(Math.max(2, Math.ceil(emp / 5)), 10), "phone channel(s)");
    default: return 1;
  }
}

/** Picks the main internet link for each site. */
function pickPrimary(pr: Profile, seg: SegmentKey): string {
  if (pr.fibreAvailable === false) return "P04";
  const emp = pr.employees ?? 1;
  const ok = (id: string) => checkEligibility(product(id), pr, PRIMARY_LINKS).ok;
  if (seg === "mfg" && emp >= 10 && ok("P05")) return "P05";
  if (seg === "multi" || (seg === "prof" && emp >= 5) || seg === "mfg") return "P02";
  return "P01";
}

export interface RecommendInput {
  profile: Profile;
  /** Products the owner explicitly asked for by name. */
  requestedProducts?: string[];
  /** Products the owner explicitly said they don't want. */
  declinedProducts?: string[];
}

export function recommend({ profile: pr, requestedProducts = [], declinedProducts = [] }: RecommendInput): Recommendation {
  const seg = inferSegment(pr)!;
  const lines: BundleLine[] = [];
  const excluded: Exclusion[] = [];
  const notes: string[] = [];
  const assumptions: string[] = [];
  const declined = new Set(declinedProducts);

  if (pr.city && !pr.cityTier) {
    notes.push(`We don't sell in ${pr.city} yet (Accel Business covers tier 1-2 cities). A partner will contact you when we launch.`);
  }

  const has = (id: string) => lines.some((l) => l.productId === id);
  const ids = () => lines.map((l) => l.productId);

  const tryAdd = (id: string, optional: boolean, why?: string) => {
    if (has(id) || declined.has(id)) return;
    const p = product(id);
    const elig = checkEligibility(p, pr, [...ids(), id]);
    if (!elig.ok) {
      if (!optional) {
        excluded.push({ productId: id, reason: elig.reasons.join("; "), alternative: ALTERNATIVES[id]?.(pr) });
      }
      return;
    }
    lines.push({ productId: id, qty: defaultQty(id, seg, pr, optional ? [] : assumptions), optional, reason: why ?? reasonFor(id, seg, pr) });
  };

  // 1. Requested primary links win; otherwise pick one for the segment.
  const requestedLinks = requestedProducts.filter((id) => PRIMARY_LINKS.includes(id));
  for (const id of requestedLinks) tryAdd(id, false);
  if (!lines.some((l) => PRIMARY_LINKS.includes(l.productId))) {
    const primary = pickPrimary(pr, seg);
    if (primary === "P04") notes.push("Fibre isn't available at your address, so we use 5G AirFiber — live in about 2 days instead of 5.");
    if (requestedLinks.length) notes.push(`Instead, we suggest ${product(primary).name}.`);
    tryAdd(primary, false);
  }

  // 2. Everything the owner asked for, by need or by product.
  for (const need of pr.needs) {
    const id = NEED_TO_PRODUCT[need];
    if (id) tryAdd(id, false);
  }
  for (const id of requestedProducts) if (!PRIMARY_LINKS.includes(id)) tryAdd(id, false);

  // 3. A few relevant add-ons the owner can switch on (never forced).
  let suggested = 0;
  for (const id of SUGGESTIONS[seg]) {
    if (suggested >= 3) break;
    const before = lines.length;
    tryAdd(id, true);
    if (lines.length > before) suggested++;
  }

  // 4. Re-check dependencies: an add-on whose prerequisite was declined is dropped.
  for (const l of [...lines]) {
    const elig = checkEligibility(product(l.productId), pr, ids());
    if (!elig.ok) {
      lines.splice(lines.indexOf(l), 1);
      if (!l.optional) excluded.push({ productId: l.productId, reason: elig.reasons.join("; ") });
    }
  }

  if (pr.hasGstin === false) {
    notes.push("Without a GSTIN some business products (WhatsApp API, SMS, IVR) aren't available. GST-registered businesses also get activated much faster — we can help you register.");
  }

  return { segment: seg, lines, excluded, notes, assumptions };
}
