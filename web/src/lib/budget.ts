import { product } from "./catalogue";
import { inr } from "./format";
import { buildQuote, type Term } from "./pricing";
import type { Recommendation } from "./recommend";

/**
 * "Price too high" is the biggest single drop reason after needs assessment
 * (414 leads). When the owner names a monthly budget (incl. GST), switch off
 * the least essential services until the plan fits. Nothing is hidden: the
 * trimmed services stay in the quote as one-tap add-ons.
 */
export function fitToBudget(rec: Recommendation, budget: number, term?: Term): Recommendation {
  const lines = rec.lines.map((l) => ({ ...l }));
  const monthly = () => buildQuote({ lines, term }).monthlyWithGst;
  const trimmed: string[] = [];
  // Later lines are less essential (connectivity comes first); always keep the first one.
  for (let i = lines.length - 1; i > 0 && monthly() > budget; i--) {
    if (lines[i].optional) continue;
    lines[i].optional = true;
    trimmed.push(product(lines[i].productId).name);
  }
  const notes = [...rec.notes];
  const total = monthly();
  if (trimmed.length) notes.push(`To fit your ${inr(budget)}/month budget (incl. GST), I've switched off ${trimmed.join(", ")}. Add any of them back in one tap.`);
  if (total > budget) notes.push(`The essentials come to ${inr(total)}/month incl. GST, ${inr(total - budget)} over your ${inr(budget)} budget. A 36-month term lowers it further.`);
  return { ...rec, lines, notes };
}
