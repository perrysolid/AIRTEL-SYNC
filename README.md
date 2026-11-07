# Accel Business — Udyam Digital

Airtel SYNC hackathon, Track A ("Project Udyam Digital"). A small-business owner talks to an advisor in their own language, by voice, on the web, WhatsApp or Telegram. They get a correct bundle and a transparent quote, verify their business in about two minutes, and watch each service switch on, without a single status-chasing call.

| Today (assisted, from the case data) | This journey |
|---|---|
| 7.4% of leads activate | every step self-serve; a partner only when asked |
| 17.6 days lead → activation | SIMs and apps the same day, fibre in 5, everything ≤ 21 |
| ₹15,053 acquisition cost per activation | advisor + Smart KYC replace 2–3 field visits |
| 3.0 status-chasing calls per customer (each one raises churn) | an update in the customer's own chat at every step |

**Try it:** Telegram bot [@UdyamAdvisorBot](https://t.me/UdyamAdvisorBot) · WhatsApp test number +1 555 136 9092 (Meta test numbers only reply to approved recipients) · web app: see [Deploy](#deploy).

## What's in it

- **Advisor (web voice and text, WhatsApp, Telegram).** Gemini with function calling gathers the facts and explains; Groq (`openai/gpt-oss-120b`) and then Claude take over if Gemini is unavailable. A deterministic rules engine is the only thing that decides eligibility and price, so the advisor cannot quote an ineligible product or invent a price. Voice in 10 Indian languages; a full offline bilingual (English/Hindi) guided mode when there is no key or network.
- **Interactive 3D shop (three.js).** A low-poly Indian shopfront where each product in the plan appears as an object: the fibre router with light pulsing in from the tower, a panning CCTV camera, Wi-Fi rings, a POS tablet, a delivery scooter. It builds itself on the landing page, fills in as the advisor shapes the plan, follows the quote's toggles, and on the tracker turns each item from marigold (setting up) to teal (live). Falls back to a still card without WebGL and respects reduced motion.
- **Quote.** Receipt-style bill: add-ons on/off, quantities, 12/24/36-month terms, One Bill discount, GST, setup savings, and what was excluded and *why*, with an alternative.
- **Smart KYC.** DigiLocker fetch or phone photos → Gemini vision (Groq `qwen/qwen3.8-27b` as backup, Tesseract on-device OCR with auto-rotation offline) → checks against the GST and Udyam registries: checksum, status, legal name, Udyam number and state, address-proof age, signatory authority and expiry.
  - **12/12 specimen applicants get the right verdict**, offline.
  - **Registry recovery:** if the GSTIN is unreadable or the Udyam certificate is missing, the other documents' business name plus location find the registration, which the owner confirms. Only a unique match counts (842 trade names repeat in the registry).
  - **No false rejections from bad photos:** a number read off a blurred photo that fails the checksum asks for a retake instead of being treated as forged. Look-alike OCR repairs are accepted only when they pass the checksum *and* exist in the registry.
- **Order and tracker.** Per-purpose consent (DPDP), e-sign by OTP, UPI AutoPay, a separate activation track per service, automatic fibre → 5G AirFiber fallback, updates pushed to the chat the order came from, `STATUS` command.
- **Chat bots.** One bot core for both channels: native buttons and lists, multi-select, voice notes, one-tap ordering inside the chat, documents redirected to the consent-first KYC page (never read in chat).
  - **Visual live updates:** the plan arrives as a quote card, and every order event (order placed, KYC verdict, e-sign, payment, each service going live, fibre → AirFiber switch, all live) arrives as one message carrying a freshly rendered status card (journey stepper + each service's state) and an *Open live tracker* button. Cards carry no personal data. `STATUS` returns the same card anytime.
- **Growth loops (aimed at where leads are lost in the case data).**
  - **Win-back links:** 2,017 leads were lost to reasons a self-serve link fixes: 1,632 before anyone advised them (unreachable, no time for a visit, visit never scheduled) and 385 to a slow or confusing quote. The console gives each a personal link; it opens the bot with their CRM details filled in, in their language, and shows a priced plan without a call or a visit.
  - **Budget fitting:** "keep it under ₹3,000" switches off the least essential services until the plan fits, and they stay one tap away. Today's spend ("Jio 399 pm") feeds a savings line.
  - **Stall reminders:** one card reminder for a saved plan nobody ordered, and one per waiting order step (KYC, e-sign, payment), only inside WhatsApp's 24-hour window.
  - **Referrals:** "everything is live" carries a *Refer a business* button with a personal share link; referred orders are tracked in the console.
- **Partner console.** Advisor hand-offs with full context, propensity-ranked call list (logistic regression, AUC 0.745, 2.4× lift in the top decile), order pipeline, funnel/channel/churn insights, masked audit log, hash-chained consent ledger.
- **Privacy.** Document images are never stored (hash only), identifiers are masked in UI and logs, and owners can export, withdraw or erase their data.

## Run it

```bash
cd web
npm install
cp .env.example .env.local     # optional: add GEMINI_API_KEY etc. — everything works without keys
npm run dev                    # http://localhost:3000
npm run telegram               # optional, second terminal: Telegram bot via long polling
```

| Page | |
|---|---|
| `/` | Landing: pick a language, tap the mic |
| `/advisor` | Advisor chat (voice / text) with the live 3D shop |
| `/quote/:session` | Adjustable quote and checkout |
| `/order/:id` | Consent → KYC → e-sign → pay → tracker |
| `/whatsapp` | WhatsApp simulator (no Meta account needed) |
| `/console` | Partner and sales console |
| `/privacy` | Privacy note and data rights |
| `/api/health` | Which integrations are configured (never their values) |

In KYC, *Demo: load a specimen applicant* runs any of K01–K12 through the real pipeline.

### Configuration

All keys are optional and live in `web/.env.local` (git-ignored; the template is `web/.env.example`).

| Variable | Used for |
|---|---|
| `GEMINI_API_KEY` | Main AI: advisor, document reading, voice notes |
| `GROQ_API_KEY` | Backup AI (`gpt-oss-120b`, `qwen3.8-27b` vision, `whisper-large-v3`) |
| `ANTHROPIC_API_KEY` | Last-resort AI |
| `AI_PROVIDER` | Move one provider (`gemini`, `groq`, `anthropic`) to the front |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Telegram bot |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | WhatsApp Cloud API bot |
| `SARVAM_API_KEY` | Natural Indian-language voice (falls back to the browser's voice) |
| `PUBLIC_BASE_URL` | Public URL for links and status cards sent by the bots (defaults to Render's own URL) |
| `BACKEND_URL` | Frontend only: proxy `/api/*` to a separate backend |
| `DATABASE_URL` | Neon Postgres for orders, sessions, consents and audit (otherwise a JSON file in `STORE_DIR`) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` | Neon Object Storage for chat cards |
| `WHATSAPP_DISPLAY_NUMBER`, `TELEGRAM_BOT_USERNAME` | Bot handles used in win-back and referral links |
| `NUDGES`, `NUDGE_QUOTE_MINUTES`, `NUDGE_ORDER_MINUTES`, `CRON_SECRET` | Stall reminders (on by default on Render) and the `/api/cron/nudges` endpoint |
| `STORE_DIR` | Where the JSON store is written when there is no database |

If a provider fails on billing or auth it is paused for 10 minutes (1 minute for a rate limit) and the app carries on with the next provider or the offline mode, so the demo never breaks.

### Tests

```bash
npm test                                   # 98 unit tests: rules, pricing, KYC, NLU, advisor tool loops (Gemini, Groq), bots, chat cards, reminders
NEON_IT=1 npx vitest run neon.int            # live Neon Postgres + object storage check
OCR_IT=1 npx vitest run extract.ocr        # image → OCR → rules for all 12 applicants
BASE=http://localhost:3000 node scripts/smoke.mjs   # end-to-end journey against a running server
npm run lint && npm run typecheck
```

### WhatsApp and Telegram bots

Telegram runs locally with `npm run telegram` (no public URL needed). WhatsApp needs a Meta app and a public https URL. Step-by-step for both: [docs/bots-setup.md](docs/bots-setup.md).

### Deploy

Frontend on **Vercel**, backend on **Render**, from this one codebase: Vercel proxies `/api/*` to Render via `BACKEND_URL`, so all secrets stay on Render. Render's free plan works (create a Web Service by hand) with Neon holding the data, so nothing is lost when it restarts; `render.yaml` is the Blueprint. On Render, the Telegram webhook is set automatically at boot. Steps: [docs/deploy.md](docs/deploy.md).

## Repository

```
web/
  src/app/            pages and API routes (advisor SSE, quote, order, kyc, whatsapp, telegram, chat cards, console, health)
  src/lib/            rules engine, pricing, KYC, registry, AI providers, store, tracker, privacy
  src/lib/bots/       shared bot core + Telegram and WhatsApp Cloud adapters
  src/components/shop three.js shop scene
  data/               case dataset (catalogue, leads, GST and Udyam registries) + propensity model
  scripts/            e2e smoke test, Telegram polling/webhook, propensity training
docs/                 architecture, deploy, bots, privacy note, business case, demo script
render.yaml           Render Blueprint for the backend
```

## Docs

- [Architecture](docs/architecture.md)
- [Deploy (Vercel + Render)](docs/deploy.md)
- [WhatsApp and Telegram setup](docs/bots-setup.md)
- [Privacy & security note](docs/privacy-note.md)
- [Business case](docs/business-case.md)
- [Demo script](docs/demo-script.md)

All businesses, people and identifiers in the dataset and specimen documents are fictional, supplied by the hackathon.
