# Business case (10 slides)

## 1. The problem
5,000 SMB leads last quarter → **7.4% activated**, taking **17.6 days**, at **₹15,053 acquisition cost per activation**. Customers made **3.0 status-chasing calls** each, and churn rises with every call.

## 2. Where leads drop
Most losses happen before a quote (no follow-up, wrong product pitched) and at documentation (KYC rejected, documents not ready). Fibre infeasibility and installation delays lose the rest. The journey fixes each drop point with one feature.

## 3. The journey
Speak in your language → correct bundle in about a minute → adjust the quote yourself → verify in 2 minutes (DigiLocker or photos) → e-sign and UPI AutoPay → watch services switch on, with WhatsApp updates.

## 4. Advisor that can't mis-sell
Gemini converses in 10 Indian languages by voice, text or WhatsApp; a rules engine decides eligibility and price. Out-of-tier products, GSTIN requirements, minimum employees and product dependencies are enforced and *explained*, with an alternative.

## 5. Smart KYC
Reads photos, auto-straightens rotated scans, checks GSTIN checksum and registry status, legal name, Udyam, address-proof age and signatory authority. **12/12 correct verdicts** on the specimen set, offline. Problems become plain-language fix-it actions, not rejections.

## 6. Staged activation, no chasing
SIMs and apps live on day 1, fibre by day 5. Each step triggers a WhatsApp update; reply `STATUS` any time. If fibre isn't feasible, 5G AirFiber is swapped in automatically.

## 7. Partners do higher-value work
Advisor hand-offs arrive with facts and quote attached. A propensity model (AUC 0.745, top-decile lift 2.4×) ranks recoverable dropped leads for today's calls.

## 8. Impact (conservative)
| Metric | Today | Target |
|---|---|---|
| Lead → activation | 7.4% | 12–15% |
| Days to first service | 17.6 | 1 (all live ≤ 21) |
| Cost per activation | ₹15,053 | < ₹6,000 |
| Chase calls / customer | 3.0 | < 0.5 |

Doubling activation on the same lead volume ≈ +370 SMBs per quarter at a ~₹2.5k–14k monthly bill each.

## 9. Trust and compliance
DPDP consent per purpose, images never stored, masked identifiers, hash-chained consent ledger, human review for every hard fail, full offline fallback.

## 10. Rollout
Pilot in 2 tier-2 cities with 20 partners (6 weeks) → measure activation, days to live and chase calls against control → scale to all tier 1–2 cities. Production: Postgres, WhatsApp Business API, DigiLocker and e-sign ASP integration.
