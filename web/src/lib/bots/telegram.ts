import { chatText, linkButtonsAllowed, type BotMessage } from "./types";

/** Telegram Bot API client: rich messages with inline keyboards. */

export function telegramEnabled() {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result as T;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function keyboard(msg: BotMessage) {
  if (msg.askContact) {
    return { keyboard: [[{ text: "📱 Share my mobile number", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true };
  }
  const rows: { text: string; callback_data?: string; url?: string }[][] = [];
  const opts = msg.options ?? [];
  const tick = new Set(msg.picked ?? []);
  for (let i = 0; i < opts.length; i += 2) {
    rows.push(
      opts.slice(i, i + 2).map((o, j) => ({
        text: msg.multi ? `${tick.has(o.value) ? "✅" : "▫️"} ${o.label}` : o.label,
        // callback_data is capped at 64 bytes, so multi-select refers to options by index.
        callback_data: msg.multi ? `m:${i + j}` : `c:${o.value}`.slice(0, 64),
      })),
    );
  }
  if (msg.multi) rows.push([{ text: tick.size ? `Done (${tick.size}) ➜` : "Done ➜", callback_data: "md" }]);
  for (const b of msg.buttons ?? []) {
    if (b.url && linkButtonsAllowed()) rows.push([{ text: b.label, url: b.url }]);
    else if (b.action) rows.push([{ text: b.label, callback_data: b.action }]);
  }
  return rows.length ? { inline_keyboard: rows } : { remove_keyboard: true };
}

export function telegramHtml(msg: BotMessage) {
  let text = chatText(esc(msg.text), (t) => `<b>${t}</b>`);
  // Without link buttons, show links inline so they still work.
  const inline = (msg.buttons ?? []).filter((b) => b.url && !linkButtonsAllowed());
  if (inline.length) text += "\n\n" + inline.map((b) => `${esc(b.label)}: ${esc(b.url!)}`).join("\n");
  if (msg.multi) text += "\n\n<i>Tap all that apply, then Done.</i>";
  return text.slice(0, 4000);
}

export async function sendTelegram(chatId: string | number, msg: BotMessage) {
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: telegramHtml(msg),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard(msg),
  });
}

export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const f = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const r = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${f.file_path}`);
  return Buffer.from(await r.arrayBuffer());
}
