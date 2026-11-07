# Privacy & security note

**Scope.** Accel Business digital journey (prototype): advisor, quote, Smart KYC, activation tracker, partner console. Designed to India's Digital Personal Data Protection Act, 2023 (DPDP).

## What we collect and why

| Purpose | Data | Retention | Consent |
|---|---|---|---|
| KYC verification | GSTIN, Udyam no., legal name, address, signatory name/role/ID validity | life of account + statutory period | required |
| Service activation | contact name, mobile, installation address, chosen services | life of account | required |
| Partner help | business type, city, enquiry summary (no documents) | 90 days | optional, off by default |
| Offers | mobile, segment | until withdrawn | optional, off by default |
| Scam Shield | the message, link or screenshot you choose to check | not stored: analysed in memory, screenshots read on-device (Tesseract) and discarded | you choose to share |
| Network check | pincode of the install address | kept on the quote/order so the right line is installed | needed to install |
| Branch-in-a-Box | new branch name, city, pincode | life of the account | required for the branch |

Notice is itemised, plain-language, versioned (`2026-07-v1`) and shown **before** any document is read — the extraction API returns 403 without a recorded consent.

## Controls

- **Data minimisation.** Document images are processed in memory and discarded. We store only the fields needed for activation plus a SHA-256 fingerprint of each file as evidence. Advisor transcripts store profile facts, not raw audio.
- **Masking everywhere.** GSTIN, Udyam, phone and ID numbers are masked in the console, order views and audit log (`maskGstin`, `maskPhone`, `redactText`). Partners never see documents.
- **Tamper-evident consent.** Each consent and withdrawal is a hash-chained ledger entry (purpose, version, timestamp, previous hash).
- **Data-principal rights.** `/privacy`: export, withdraw a purpose, erase — verified with order ID + last 4 of mobile. Erasure removes KYC fields and contact details while keeping the minimal consent/audit trail the law requires.
- **AI safety.** The LLM never decides eligibility or price; tool inputs are schema-validated; document text is treated as data, not instructions; the advisor hands off to a human on request or low confidence. Use paid-tier Gemini (primary), Groq and Claude APIs, whose data is not used for training; documents go only to the vision model, never to the chat model.
- **Fair KYC.** Ambiguous or failed checks go to human review with the reason shown — never a silent rejection. OCR corrections are accepted only when they pass the GSTIN checksum and match the registry.
- **Chat channels.** Bots never read documents in chat; they send the owner to the consent-first KYC page. A Telegram contact is accepted only if it is the sender's own number.
- **Transport and access.** HTTPS only; WhatsApp (Meta `X-Hub-Signature-256`), Telegram (secret-token header) and Twilio webhook signatures verified; the public frontend holds no secrets and proxies to the backend; upload type/size limits (PNG/JPEG/WebP, 6 MB); secrets in environment variables, never in the client.

## Production hardening (next)

Postgres with row-level security and encryption at rest; KMS-managed keys; role-based console access with SSO; DigiLocker and Aadhaar e-sign through licensed ASPs; data residency in India; DPIA and annual audit; breach notification runbook (72-hour board/user notice).
