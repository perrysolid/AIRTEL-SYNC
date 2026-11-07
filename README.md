# Accel Business — Digital SMB Journey

Airtel Sync hackathon prototype. A small-business owner talks (in their own language, by voice or WhatsApp) to an advisor, gets a correct bundle and a transparent quote, verifies their business in two minutes, and watches services switch on — without a single status-chasing call.

| Today (assisted, from the case data) | This journey |
|---|---|
| 7.4% of leads activate | every step self-serve, partner only when asked |
| 17.6 days lead → activation | SIMs/apps same day, fibre in 5, everything ≤ 21 |
| ₹15,053 acquisition cost per activation | advisor + Smart KYC replace 2–3 field visits |
| 3.0 status-chasing calls per customer (each one ↑ churn) | proactive WhatsApp updates at every step |

## What's in it

- **Advisor (web voice, text, WhatsApp, Telegram)** — Gemini with function calling (Claude as optional second provider) gathers facts and explains; a deterministic rules engine is the only thing that decides eligibility and price, so it cannot quote an ineligible product or invent a price. 10 Indian languages for voice; full offline bilingual (English/Hindi) guided mode when no API key or network. Numbered replies ("2") work on WhatsApp.
- **Quote** — receipt-style bill, add-ons toggle on/off, quantities, 12/24/36-month terms, One Bill discount, GST, setup savings, what was excluded and *why*, with an alternative.
- **Smart KYC** — DigiLocker fetch or phone photos → Gemini vision (or Tesseract offline, auto-rotation) → cross-checks against the GST and Udyam registries: checksum, status, legal name, Udyam, address-proof age, signatory authority and expiry. Look-alike OCR repairs only accepted when they pass checksum *and* exist in the registry. **12/12 specimen applicants get the right verdict offline.**
- **Order & tracker** — consent (DPDP, per purpose), e-sign by OTP, UPI AutoPay, per-service activation tracks, automatic fibre → 5G AirFiber fallback, WhatsApp notification feed, `STATUS` keyword.
- **Partner console** — advisor hand-offs with full context, propensity-ranked call list (logistic regression, AUC 0.745, 2.4× lift in top decile), order pipeline, funnel/channel/churn insights, masked audit log, hash-chained consent ledger.
- **Privacy** — images never stored (hash only), identifiers masked in UI and logs, export/withdraw/erase.

## Run it

```bash
cd web
npm install
cp .env.example .env.local     # optional: add GEMINI_API_KEY etc.
npm run dev                    # http://localhost:3000
```

| Page | |
|---|---|
| `/` | Landing: pick language, tap the mic |
| `/advisor` | Advisor chat (voice / text) |
| `/quote/:session` | Adjustable quote and checkout |
| `/order/:id` | Consent → KYC → e-sign → pay → tracker |
| `/whatsapp` | WhatsApp simulator (same webhook Twilio calls) |
| `/console` | Partner and sales console |
| `/privacy` | Privacy note and data rights |

In KYC, *Demo: load a specimen applicant* runs any of K01–K12 through the real pipeline.

### Tests

```bash
npm test                                   # 82 unit tests: rules, pricing, KYC, NLU, advisor, Gemini tool loop, bots
OCR_IT=1 npx vitest run extract.ocr        # image → OCR → rules for all 12 applicants
BASE=http://localhost:3000 node scripts/smoke.mjs   # end-to-end journey against a running server
```

If a provider fails on billing, auth or quota, it is paused for 10 minutes and the app carries on with the next provider or the offline mode — the demo never breaks.

### WhatsApp and Telegram bots

Same advisor in chat, with native buttons, voice notes, one-tap ordering and order updates pushed to the chat. Telegram runs locally with `npm run telegram` (no public URL). Setup for both: [docs/bots-setup.md](docs/bots-setup.md).

### Deploy

Frontend on **Vercel**, backend on **Render**, from this one codebase: Vercel proxies `/api/*` to Render via `BACKEND_URL`. Render is configured by `render.yaml`. Steps: [docs/deploy.md](docs/deploy.md).

## Docs

- [Architecture](docs/architecture.md)
- [Privacy & security note](docs/privacy-note.md)
- [Business case](docs/business-case.md)
- [Demo script](docs/demo-script.md)
- [WhatsApp and Telegram setup](docs/bots-setup.md)
