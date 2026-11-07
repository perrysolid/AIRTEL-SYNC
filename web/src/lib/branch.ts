import { product } from "./catalogue";
import { adaptForAirFiber, checkNetwork, type NetworkResult } from "./network";
import { notifyOrder } from "./notify";
import { buildQuote, type Quote, type Term } from "./pricing";
import { sha256 } from "./privacy";
import { tierForCity, type Profile } from "./profile";
import type { BundleLine } from "./recommend";
import { newId, now, store, type Order } from "./store";
import { advance, buildTimeline } from "./tracker";

/**
 * Branch-in-a-Box: opening a second shop should not restart the whole journey.
 * We copy the head-office configuration to the new address, reuse the verified KYC and consent, run the network
 * check for the new pincode and start activation. Only the new address proof is still needed from the owner.
 */

/** Units that belong to the account, not a location: shared across branches, never duplicated. */
const ACCOUNT_LEVEL = new Set(["per account", "per pack", "per number", "per IP"]);

export interface BranchInput {
  name: string;
  city: string;
  pincode: string;
  /** Headcount at the new branch; scales per-person products. Defaults to the head-office average per site. */
  staff?: number;
}

export interface BranchPreview {
  name: string;
  city: string;
  pincode: string;
  lines: BundleLine[];
  quote: Quote;
  network: NetworkResult;
  removed: string[];
  kycReused: true;
  needs: string[];
  newSites: number;
  parentMonthlyWithGst: number;
  totalAfter: number;
  copiedFrom: string;
}

export type BranchPreviewResult = { ok: true; preview: BranchPreview } | { ok: false; error: string };

export function previewBranch(parent: Order, input: BranchInput): BranchPreviewResult {
  const net = checkNetwork(input.pincode, input.city);
  if (!net.ok) return { ok: false, error: net.error };
  if (!tierForCity(input.city)) return { ok: false, error: `Accel doesn't serve ${input.city} yet. Branches must be in a Tier 1–2 city.` };

  const sites = Math.max(1, parent.profile.sites ?? 1);
  const employees = Math.max(1, parent.profile.employees ?? 3);
  let lines: BundleLine[] = [];
  for (const l of parent.lines) {
    const p = product(l.productId);
    if (ACCOUNT_LEVEL.has(p.unit)) continue;
    const qty = p.unit === "per site" ? 1 : input.staff ? Math.max(1, Math.round((l.qty * input.staff) / employees)) : Math.max(1, Math.round(l.qty / sites));
    lines.push({ productId: l.productId, qty, optional: false, reason: l.reason });
  }
  let removed: string[] = [];
  if (net.recommended === "airfiber") ({ items: lines, removed } = adaptForAirFiber(lines));
  const quote = buildQuote({ lines, term: parent.term as Term });
  return {
    ok: true,
    preview: {
      name: input.name, city: input.city, pincode: net.pincode, lines, quote, network: net, removed, kycReused: true,
      needs: ["Address proof of the new branch (≤ 90 days old)"],
      newSites: sites + 1,
      parentMonthlyWithGst: parent.quote.monthlyWithGst,
      totalAfter: parent.quote.monthlyWithGst + quote.monthlyWithGst,
      copiedFrom: parent.id,
    },
  };
}

export function createBranch(parent: Order, input: BranchInput): { ok: true; order: Order; preview: BranchPreview } | { ok: false; error: string } {
  const r = previewBranch(parent, input);
  if (!r.ok) return r;
  const pv = r.preview;
  const active = pv.quote.lines.filter((l) => l.active && !l.blockedReason);
  const id = newId("ord").toUpperCase().replace("ORD_", "ACC-");
  const employees = Math.max(1, parent.profile.employees ?? 3);
  const profile: Profile = { ...parent.profile, city: input.city, cityTier: tierForCity(input.city), sites: 1, employees: input.staff ?? Math.max(1, Math.round(employees / Math.max(1, parent.profile.sites ?? 1))), fibreAvailable: pv.network.recommended === "airfiber" ? false : parent.profile.fibreAvailable };
  const order: Order = {
    id: id,
    createdAt: now(),
    businessName: `${parent.businessName} – ${input.name}`,
    city: input.city,
    contactName: parent.contactName,
    phone: parent.phone,
    channel: parent.channel,
    partnerCode: parent.partnerCode,
    profile,
    lines: active,
    term: parent.term,
    quote: pv.quote,
    // Reused from head office: consent, verified KYC, and the e-signed agreement (as an addendum).
    consentId: parent.consentId,
    kyc: parent.kyc,
    esign: { at: now(), method: "aadhaar-otp-mock", docHash: sha256(`branch-addendum:${parent.id}:${id}`) },
    payment: { at: now(), method: "Added to your existing bill", amount: pv.quote.monthlyWithGst + pv.quote.setupTotal, ref: `BR${id.slice(-6)}` },
    timeline: buildTimeline(active.map((l) => l.productId)),
    notifications: [],
    botChat: parent.botChat,
    pincode: pv.pincode,
    parentId: parent.id,
    pendingDocs: pv.needs,
  };
  order.timeline.clockDay = 0;
  advance(order.timeline, 0);
  notifyOrder(order, `🏪 Branch '${input.name}' set up from your head-office configuration. KYC reused; just upload the new address proof.`);
  store.saveOrder(order);
  (parent.branches ??= []).push({ id, name: input.name, city: input.city });
  parent.profile = { ...parent.profile, sites: (parent.profile.sites ?? 1) + 1 };
  notifyOrder(parent, `🏪 New branch '${input.name}' (${input.city}) created as order ${id}. Added ₹${pv.quote.monthlyWithGst.toLocaleString("en-IN")}/month incl. GST.`);
  store.saveOrder(parent);
  store.audit("owner", "order:branch", id, `from ${parent.id}`);
  return { ok: true, order, preview: pv };
}
