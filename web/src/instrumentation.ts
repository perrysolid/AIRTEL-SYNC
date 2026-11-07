/**
 * Boot: load the store from Neon Postgres (when DATABASE_URL is set). Then, on
 * the backend (Render sets RENDER_EXTERNAL_URL), point the Telegram bot's
 * webhook at this server, so a deploy needs no manual step. Locally nothing
 * happens and `npm run telegram` (long polling) is used instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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
