// Runs the Telegram bot on your laptop — no public URL or ngrok needed.
// Pulls updates from Telegram and forwards them to the local /api/telegram route.
//   npm run dev            (in one terminal)
//   npm run telegram       (in another)
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE = process.env.BASE ?? "http://localhost:3000";
if (!TOKEN) {
  console.error("Set TELEGRAM_BOT_TOKEN in web/.env.local (get one from @BotFather).");
  process.exit(1);
}
const api = async (method, body = {}) => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
};

await import("./telegram-profile.mjs").then((m) => m.setupProfile(api));
await api("deleteWebhook", { drop_pending_updates: false });
const me = await api("getMe");
console.log(`🤖 @${me.username} is live — open https://t.me/${me.username} and say hi. Forwarding to ${BASE}/api/telegram`);

let offset = 0;
for (;;) {
  try {
    const updates = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
    for (const u of updates) {
      offset = u.update_id + 1;
      const r = await fetch(`${BASE}/api/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.TELEGRAM_WEBHOOK_SECRET && { "X-Telegram-Bot-Api-Secret-Token": process.env.TELEGRAM_WEBHOOK_SECRET }) },
        body: JSON.stringify(u),
      });
      const who = u.message?.from?.first_name ?? u.callback_query?.from?.first_name ?? "?";
      console.log(`${new Date().toLocaleTimeString()} ${who}: ${(u.message?.text ?? u.callback_query?.data ?? (u.message?.voice ? "[voice]" : "[other]")).slice(0, 60)} → ${r.status}`);
    }
  } catch (err) {
    console.warn("poll error:", err.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
