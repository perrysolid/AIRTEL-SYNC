import { now, type BotChat, type Order } from "./store";
import { orderCardUrl } from "./cards";
import { liveDay } from "./tracker";
import { publicUrl, type BotMessage } from "./bots/types";
import { sendTelegram, telegramEnabled } from "./bots/telegram";
import { sendWhatsApp, sendWhatsAppTemplate, whatsappCloudEnabled } from "./bots/whatsapp-cloud";
import { customerForOrder } from "./customers";

/**
 * Records owner updates on the order and, when the order came from a chat
 * bot, delivers them to that chat as one message: the live status card, the
 * update text and a button to the tracker. Delivery failures never block the
 * journey.
 */
export function notifyOrder(o: Order, update: string | string[]) {
  const lines = (Array.isArray(update) ? update : [update]).filter(Boolean);
  if (!lines.length) return;
  for (const text of lines) o.notifications.push({ at: now(), channel: o.botChat?.channel ?? "whatsapp", text });
  const started = !!o.payment;
  const allLive = started && o.timeline.clockDay >= liveDay(o.timeline);
  // Referrals convert best of all lead sources (14.8%): ask at the happiest moment.
  const msg: BotMessage = {
    text: lines.join("\n"),
    image: orderCardUrl(o),
    buttons: [
      { label: started ? "Open live tracker" : "Continue my order", url: publicUrl(`/order/${o.id}`) },
      ...(allLive ? [{ label: "🎁 Refer a business", action: "a:refer" }] : []),
    ],
  };
  // Every chat this owner reaches us on: the bot chat the order came from, plus the
  // WhatsApp number and Telegram chat of their signed-in account. Only numbers verified
  // by OTP are messaged, never a number someone just typed into a form.
  const chats: BotChat[] = o.botChat ? [o.botChat] : [];
  const c = customerForOrder(o);
  if (c?.notify.whatsapp && !c.demo) chats.push({ channel: "whatsapp", chatId: c.phone });
  if (c?.notify.telegram && c.telegramChatId) chats.push({ channel: "telegram", chatId: c.telegramChatId });
  const seen = new Set<string>();
  for (const chat of chats) {
    const key = `${chat.channel}:${chat.chatId.replace(/\D/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const windowClosed = chat.channel === "whatsapp" && c?.phone === chat.chatId && chat !== o.botChat && !withinWhatsAppWindow(c.whatsappInboundAt);
    void (windowClosed ? deliverTemplate(chat.chatId, o, lines) : deliver(chat, msg));
  }
}

/** WhatsApp allows free-form messages for 24 hours after the customer last wrote to us. */
export const withinWhatsAppWindow = (lastInbound?: string, at = Date.now()) => !!lastInbound && at - Date.parse(lastInbound) < 23.5 * 3600_000;

async function deliverTemplate(to: string, o: Order, lines: string[]) {
  const name = process.env.WHATSAPP_UPDATE_TEMPLATE;
  if (!whatsappCloudEnabled()) return;
  if (!name) {
    console.warn(`[notify] ${o.id}: WhatsApp window closed and WHATSAPP_UPDATE_TEMPLATE is not set; update shown in the app only`);
    return;
  }
  try {
    await sendWhatsAppTemplate(to, name, [o.id, lines.join(" ")]);
  } catch (err) {
    console.warn(`[notify] whatsapp template failed: ${(err as Error).message}`);
  }
}

export async function deliver(chat: BotChat, msg: BotMessage) {
  if (!(chat.channel === "telegram" ? telegramEnabled() : whatsappCloudEnabled())) return;
  try {
    if (chat.channel === "telegram") await sendTelegram(chat.chatId, msg);
    else await sendWhatsApp(chat.chatId, msg);
  } catch (err) {
    console.warn(`[notify] ${chat.channel} delivery failed: ${(err as Error).message}`);
  }
}
