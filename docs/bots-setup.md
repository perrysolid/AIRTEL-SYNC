# WhatsApp and Telegram bots

Both bots share one brain (`web/src/lib/bots/core.ts`): the same advisor, rules engine, in-chat ordering and order tracking as the web app. Order updates (KYC verified, payment received, each service going live) are pushed to the chat the order came from.

| | Telegram | WhatsApp (Cloud API) |
|---|---|---|
| Options | Inline buttons; multi-select with ✅ toggles | Reply buttons (≤3) or a list (≤10); multi-select by numbers ("1,3") |
| Voice notes | Transcribed (Gemini, or Groq Whisper as backup), shown back, answered | Same |
| Ordering | "✅ Order this plan" → share-number button → order | Uses the sender's number — one tap |
| Documents | Redirected to the consent-first secure KYC page (never read in chat) | Same |
| Commands | /start /status /new /human /help (English + Hindi menus) | STATUS, NEW, HUMAN, HELP |

## Telegram (5 minutes)

1. In Telegram, open **@BotFather** → `/newbot` → choose a name (e.g. *Accel Business Advisor*) and a username ending in `bot`.
2. Copy the token into `web/.env.local`: `TELEGRAM_BOT_TOKEN=...`
3. Run the app and the bot:
   ```bash
   cd web
   npm run dev          # terminal 1
   npm run telegram     # terminal 2 — sets commands/description and starts polling
   ```
4. Open the `t.me/<username>` link it prints and say *hi*.

Deployed on Render: nothing to do — at boot the backend points the webhook at `RENDER_EXTERNAL_URL/api/telegram` (stop any local `npm run telegram`, which removes it). Elsewhere: set `TELEGRAM_WEBHOOK_SECRET` and `BOT_WEBHOOK_BASE_URL` (or `PUBLIC_BASE_URL`), then `npm run telegram:webhook` once. With an https `PUBLIC_BASE_URL`, quote and KYC links become tap-to-open buttons.

## WhatsApp Cloud API (Meta)

1. **Create the app.** [Meta App Dashboard](https://developers.facebook.com/apps) → *Create App* → use case **Connect with customers through WhatsApp** → pick or create a business portfolio. An existing app without WhatsApp in its left menu: *Use cases* → *Add use case* → **Connect with customers through WhatsApp**. You don't need the App ID.
2. **API Setup.** *Start using the API* → connect/create a WhatsApp Business account. Meta gives you a free **test number**. Add your own WhatsApp number under *To* (up to 5 test recipients) and send the `hello_world` template to confirm.
3. **Copy into `web/.env.local`:**
   - `WHATSAPP_PHONE_NUMBER_ID` — the test number's *Phone number ID* (not the number itself)
   - `WHATSAPP_TOKEN` — the temporary token works for 24 h; for the demo create a **System user** in Business Settings → *Generate token* with `whatsapp_business_messaging` + `whatsapp_business_management`
   - `WHATSAPP_APP_SECRET` — App settings → Basic → App secret
   - `WHATSAPP_VERIFY_TOKEN` — any random string you choose
4. **Expose the app over https** (Meta can't reach localhost):
   ```bash
   ngrok http 3000          # or: npx cloudflared tunnel --url http://localhost:3000
   ```
   Cloudflare quick tunnels need outbound port 7844; on networks that block it, use ngrok (port 443).
   Put the https URL in `PUBLIC_BASE_URL` and restart `npm run dev`.
5. **Webhook.** WhatsApp → Configuration → Webhook: callback URL `https://<public-url>/api/whatsapp`, verify token = your `WHATSAPP_VERIFY_TOKEN` → *Verify and save* → subscribe to the **messages** field. On the generic *Webhooks* page, first switch the object dropdown from *User* to **WhatsApp Business Account**, or `messages` won't be listed.
6. **Publish the app.** While unpublished, Meta delivers only its own dashboard test webhooks, not real messages. App settings → Basic: privacy policy URL and data-deletion URL (`https://<frontend>/privacy`), category, icon → *Publish*.
7. From your WhatsApp, message the test number *hi*. `/api/health` shows `"whatsapp": true` when the token and phone number ID are set.

**Limits to know:** free-form replies are allowed within 24 h of the customer's last message (the *customer service window*). Updates outside that window (e.g. "fibre installed" on day 5) need an approved **template** — for production, register `order_update` utility templates; for the demo, the customer has always messaged recently.

**Alternative:** Twilio's WhatsApp sandbox also works (form-encoded webhook to the same URL, `TWILIO_AUTH_TOKEN`), and `/whatsapp` in the app is a built-in simulator that needs no account.
