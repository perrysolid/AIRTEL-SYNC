import type { NetworkResult } from "./network";
import { buildQuote } from "./pricing";
import { recommend } from "./recommend";
import type { AdvisorSession } from "./store";

/**
 * Records the pincode on a quote session and, when the Network Reality Check says fibre isn't available,
 * re-runs the recommendation on 5G AirFiber (and back to fibre if it is). Returns true when the quote changed.
 */
export function applyNetworkToSession(s: AdvisorSession, result: NetworkResult): boolean {
  s.profile.pincode = result.pincode;
  const before = s.profile.fibreAvailable;
  if (result.recommended === "fibre") s.profile.fibreAvailable = undefined;
  else if (result.recommended === "airfiber") s.profile.fibreAvailable = false;
  if (!s.recommendation || before === s.profile.fibreAvailable) return false;
  const rec = recommend({ profile: s.profile, requestedProducts: s.requestedProducts, declinedProducts: s.declinedProducts });
  s.recommendation = rec;
  s.quote = buildQuote({ lines: rec.lines, term: s.quote?.term, currentMonthlySpend: s.profile.monthlySpend });
  return true;
}
