import { after } from "next/server";
import { botTurn, currentSession, documentRedirect, transcribeVoice, VOICE_UNAVAILABLE } from "@/lib/bots/core";
import { downloadTelegramFile, keyboard, sendTelegram, telegramHtml, tg } from "@/lib/bots/telegram";
import type { BotMessage } from "@/lib/bots/types";
import { store, type BotChat } from "@/lib/store";
import { readTelegramLinkCode } from "@/lib/auth";
import { linkTelegram } from "@/lib/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram bot webhook (also fed by scripts/telegram-poll.mjs for local dev).
 * Acknowledges at once and replies in the background so Telegram never retries.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Update = any;

const g = globalThis as unknown as { __tgSeen?: Set<number> };
const seen = (g.__tgSeen ??= new Set());

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("Forbidden", { status: 403 });
  const update: Update = await req.json().catch(() => null);
  if (!update?.update_id || seen.has(update.update_id)) return Response.json({ ok: true });
  seen.add(update.update_id);
  if (seen.size > 5000) seen.delete(seen.values().next().value!);

  after(() => handle(update).catch((err) => console.error("[telegram]", err)));
  return Response.json({ ok: true });
}

async function reply(chatId: number, msgs: BotMessage[]) {
  for (const m of msgs) await sendTelegram(chatId, m);
}

async function handle(update: Update) {
  if (update.callback_query) return handleCallback(update.callback_query);
  const m = update.message;
  if (!m?.chat?.id || m.chat.type !== "private") return;
  const chat: BotChat = { channel: "telegram", chatId: String(m.chat.id) };
  const base = { chat, firstName: m.from?.first_name, language: m.from?.language_code };
  void tg("sendChatAction", { chat_id: m.chat.id, action: "typing" }).catch(() => {});

  if (m.contact) {
    // Only accept the sender's own number.
    if (m.contact.user_id && m.contact.user_id !== m.from?.id) return reply(m.chat.id, [{ text: "Please share your own number using the button below.", askContact: true }]);
    return reply(m.chat.id, await botTurn({ ...base, text: "", phone: m.contact.phone_number }));
  }
  if (m.voice || m.audio) {
    const v = m.voice ?? m.audio;
    const transcript = await transcribeVoice(await downloadTelegramFile(v.file_id), v.mime_type ?? "audio/ogg");
    if (!transcript) return reply(m.chat.id, [VOICE_UNAVAILABLE]);
    await tg("sendMessage", { chat_id: m.chat.id, text: `🎙️ <i>${transcript.replace(/</g, "&lt;")}</i>`, parse_mode: "HTML", reply_to_message_id: m.message_id });
    return reply(m.chat.id, await botTurn({ ...base, text: transcript }));
  }
  if (m.photo || m.document) return reply(m.chat.id, [documentRedirect(chat)]);
  const link = typeof m.text === "string" ? /^\/start\s+l_(\S+)$/.exec(m.text.trim()) : null;
  if (link) {
    const id = readTelegramLinkCode(link[1]);
    const c = id ? linkTelegram(id, chat.chatId) : undefined;
    return reply(m.chat.id, [{ text: c ? `✅ Linked${c.name ? `, ${c.name}` : ""}! Updates on your Accel Business orders will now come here too. Ask me anything, any time.` : "That link has expired. Open your account page and tap “Get updates on Telegram” again." }]);
  }
  if (typeof m.text === "string") return reply(m.chat.id, await botTurn({ ...base, text: m.text }));
}

async function handleCallback(q: Update) {
  const chatId = q.message?.chat?.id;
  if (!chatId) return;
  const chat: BotChat = { channel: "telegram", chatId: String(chatId) };
  const data: string = q.data ?? "";
  await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});

  // Multi-select: toggle ticks in place, then send all picks on Done.
  if (data.startsWith("m:") || data === "md") {
    const s = currentSession(chat);
    const options = s?.lastChips ?? [];
    if (!s || !options.length) return;
    const picked = new Set(s.multiPick ?? []);
    if (data === "md") {
      if (!picked.size) return;
      await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
      const labels = options.filter((o) => picked.has(o.value)).map((o) => o.label).join(", ");
      await tg("sendMessage", { chat_id: chatId, text: `✔️ ${labels}` });
      return reply(chatId, await botTurn({ chat, text: "needs:" + [...picked].join(","), firstName: q.from?.first_name }));
    }
    const opt = options[Number(data.slice(2))];
    if (!opt) return;
    if (picked.has(opt.value)) picked.delete(opt.value);
    else picked.add(opt.value);
    s.multiPick = [...picked];
    store.saveSession(s);
    const msg: BotMessage = { text: "", options, multi: true, picked: s.multiPick };
    return tg("editMessageReplyMarkup", { chat_id: chatId, message_id: q.message.message_id, reply_markup: keyboard(msg) }).catch(() => {});
  }

  // Single choice: show what was picked, remove the buttons, continue the conversation.
  if (data.startsWith("c:")) {
    const label = q.message?.reply_markup?.inline_keyboard?.flat().find((b: { callback_data?: string }) => b.callback_data === data)?.text ?? data.slice(2);
    await tg("editMessageText", { chat_id: chatId, message_id: q.message.message_id, text: telegramHtml({ text: q.message.text ?? "" }) + `\n\n✔️ <b>${label}</b>`, parse_mode: "HTML" }).catch(() => {});
  }
  void tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  return reply(chatId, await botTurn({ chat, text: data, firstName: q.from?.first_name, language: q.from?.language_code }));
}
