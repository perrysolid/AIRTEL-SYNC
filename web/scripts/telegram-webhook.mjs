// Production mode: points Telegram at <PUBLIC_BASE_URL>/api/telegram.
//   node --env-file=.env.local scripts/telegram-webhook.mjs
const { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: SECRET } = process.env;
const URL_ = process.env.BOT_WEBHOOK_BASE_URL ?? process.env.PUBLIC_BASE_URL;
if (!TOKEN || !URL_?.startsWith("https://")) {
  console.error("Need TELEGRAM_BOT_TOKEN and an https PUBLIC_BASE_URL.");
  process.exit(1);
}
const api = async (method, body = {}) => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
};
await (await import("./telegram-profile.mjs")).setupProfile(api);
await api("setWebhook", { url: `${URL_.replace(/\/$/, "")}/api/telegram`, secret_token: SECRET, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
console.log("Webhook set:", (await api("getWebhookInfo")).url);
