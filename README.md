# Accel SYNC: Project Udyam Digital

Digital-first acquisition and onboarding for MSMEs. Discover a bundle, buy it, verify KYC and track activation in one sitting, on a phone, in your language.

## Run it

```bash
# backend (Python 3.11+)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000

# frontend (Node 20+)
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8000)
```

First start trains the lead-scoring model and pre-reads the 12 specimen KYC applicants (about 1-2 minutes in the background).
Optional: set `ANTHROPIC_API_KEY` for free-text understanding in regional languages. Everything works offline without it.

## What is in it

| Requirement | Where |
| --- | --- |
| Advisor (GenAI, Hindi + regional) | `/advisor`, `backend/app/advisor.py`; 10 languages, voice in/out, rules engine + optional Claude |
| Quote & checkout | `/quote`; transparent price, add-on toggles, 12/24-month pricing, GST breakdown |
| Smart KYC | `/kyc`; DPDP consent, GSTIN/Udyam lookup, OCR, cross-document checks, e-sign |
| Tracker | `/track/:id`; timeline from `typical_install_days`, WhatsApp milestones |
| Stretch: WhatsApp | `/whatsapp`, Twilio-compatible `POST /api/whatsapp/webhook` |
| Stretch: back-office | `/ops`; hand-offs, propensity-ranked leads, funnel/segment economics, KPI targets |

Design rule: the LLM only extracts and explains; eligibility, dependencies and pricing always come from `product_catalogue.csv` rules.
