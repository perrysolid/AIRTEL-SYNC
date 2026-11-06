import { PRIMARY_LINKS, product } from "./catalogue";
import type { BundleLine } from "./recommend";

/**
 * Transparent pricing: one monthly number, everything else visible.
 * - Catalogue gives a price band per product; a longer commitment moves the
 *   price from the top of the band (12 months) to the bottom (36 months).
 * - "One Bill" discount: 5% off when the bundle spans 3+ product categories.
 * - Setup fees: half off on 24 months, waived on 36 months.
 */

export const TERMS = [12, 24, 36] as const;
export type Term = (typeof TERMS)[number];
export const GST_RATE = 0.18;
export const ONE_BILL_DISCOUNT = 0.05;

const TERM_POSITION: Record<Term, number> = { 12: 0, 24: 0.5, 36: 1 };
const SETUP_DISCOUNT: Record<Term, number> = { 12: 0, 24: 0.5, 36: 1 };

export function unitPrice(productId: string, term: Term): number {
  const p = product(productId);
  return Math.round(p.priceMax - (p.priceMax - p.priceMin) * TERM_POSITION[term]);
}

export interface QuoteLine {
  productId: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  unitPrice: number;
  monthly: number;
  setup: number;
  optional: boolean;
  active: boolean;
  /** Set when an active line can't be sold because its prerequisite was switched off. */
  blockedReason?: string;
  reason: string;
  installDays: number;
}

export interface Quote {
  term: Term;
  allowedTerms: Term[];
  lines: QuoteLine[];
  subtotal: number;
  oneBillDiscount: number;
  monthly: number;
  gst: number;
  monthlyWithGst: number;
  setupTotal: number;
  setupSaved: number;
  categories: number;
  /** Positive = cheaper than today's telecom spend. */
  savingsVsToday?: number;
  firstLiveInDays: number;
  allLiveInDays: number;
}

export interface QuoteInput {
  lines: BundleLine[];
  /** productId -> active. Missing means: active unless optional. */
  toggles?: Record<string, boolean>;
  /** productId -> quantity override. */
  quantities?: Record<string, number>;
  term?: Term;
  currentMonthlySpend?: number;
}

export function buildQuote({ lines, toggles = {}, quantities = {}, term, currentMonthlySpend }: QuoteInput): Quote {
  const isActive = (l: BundleLine) => toggles[l.productId] ?? !l.optional;
  const activeIds = lines.filter(isActive).map((l) => l.productId);

  // The longest minimum contract among active lines sets the shortest allowed term.
  const minTerm = Math.max(12, ...activeIds.map((id) => product(id).minContract));
  const allowedTerms = TERMS.filter((t) => t >= minTerm);
  const chosen: Term = term && allowedTerms.includes(term) ? term : allowedTerms[0];

  const qLines: QuoteLine[] = lines.map((l) => {
    const p = product(l.productId);
    const qty = Math.max(1, Math.round(quantities[l.productId] ?? l.qty));
    const active = isActive(l);
    const missingDep = p.requiresOneOf.length > 0 && !p.requiresOneOf.some((id) => activeIds.includes(id));
    const blockedReason = active && missingDep ? `Needs an internet line (${p.requiresOneOf.filter((id) => PRIMARY_LINKS.includes(id)).join("/")}) in the bundle` : undefined;
    const price = unitPrice(p.id, chosen);
    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      qty,
      unitPrice: price,
      monthly: price * qty,
      setup: p.setupFee * qty,
      optional: l.optional,
      active,
      blockedReason,
      reason: l.reason,
      installDays: p.installDays,
    };
  });

  const billable = qLines.filter((l) => l.active && !l.blockedReason);
  const subtotal = billable.reduce((s, l) => s + l.monthly, 0);
  const categories = new Set(billable.map((l) => l.category)).size;
  const oneBillDiscount = categories >= 3 ? Math.round(subtotal * ONE_BILL_DISCOUNT) : 0;
  const monthly = subtotal - oneBillDiscount;
  const gst = Math.round(monthly * GST_RATE);
  const setupGross = billable.reduce((s, l) => s + l.setup, 0);
  const setupSaved = Math.round(setupGross * SETUP_DISCOUNT[chosen]);
  const days = billable.map((l) => l.installDays);

  return {
    term: chosen,
    allowedTerms,
    lines: qLines,
    subtotal,
    oneBillDiscount,
    monthly,
    gst,
    monthlyWithGst: monthly + gst,
    setupTotal: setupGross - setupSaved,
    setupSaved,
    categories,
    savingsVsToday: currentMonthlySpend ? currentMonthlySpend - monthly : undefined,
    firstLiveInDays: days.length ? Math.min(...days) : 0,
    allLiveInDays: days.length ? Math.max(...days) : 0,
  };
}

