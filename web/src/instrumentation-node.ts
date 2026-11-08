/**
 * Boot: load the store from Neon Postgres (when DATABASE_URL is set). Then, on
 * the backend (Render sets RENDER_EXTERNAL_URL), point the Telegram bot's
 * webhook at this server, so a deploy needs no manual step. Locally nothing
 * happens and `npm run telegram` (long polling) is used instead.
 */
export async function registerNode() {
  // Load orders, sessions and consents from Neon before taking requests.
  const { hydrateStore } = await import("./lib/store");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await hydrateStore();
      break;
    } catch (e) {
      console.error(`[store] could not load from Postgres (attempt ${attempt}): ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }

  // Stall reminders every 5 minutes on the always-on backend (NUDGES=off to disable).
  if (process.env.NUDGES !== "off" && (process.env.RENDER_EXTERNAL_URL || process.env.NUDGES === "on")) {
    const { runNudges } = await import("./lib/nudges");
    setInterval(() => void runNudges().catch((e) => console.warn(`[nudges] ${(e as Error).message}`)), 5 * 60_000).unref();
  }

  // WhatsApp on an ordinary number, as a linked device (WA_LINK=on). Reconnects with the saved login.
  if (process.env.WA_LINK === "on") {
    const { startWaLink } = await import("./lib/bots/wa-link");
    void startWaLink().catch((e) => console.warn(`[wa-link] ${(e as Error).message}`));
  }

  const base = process.env.BOT_WEBHOOK_BASE_URL ?? process.env.RENDER_EXTERNAL_URL;
  if (!base?.startsWith("https://") || !process.env.TELEGRAM_BOT_TOKEN) return;
  const { tg } = await import("./lib/bots/telegram");
  try {
    await tg("setWebhook", { url: `${base.replace(/\/$/, "")}/api/telegram`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message", "callback_query"] });
    console.log(`[telegram] webhook → ${base}/api/telegram`);
  } catch (e) {
    console.warn(`[telegram] setWebhook failed: ${(e as Error).message}`);
  }
}
