import { now, type BotChat, type Order } from "./store";
import { orderCardUrl } from "./cards";
import { publicUrl, type BotMessage } from "./bots/types";
import { sendTelegram, telegramEnabled } from "./bots/telegram";
import { sendWhatsApp, whatsappCloudEnabled } from "./bots/whatsapp-cloud";

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
  if (!o.botChat) return;
  const started = !!o.payment;
  void deliver(o.botChat, {
    text: lines.join("\n"),
    image: orderCardUrl(o),
    buttons: [{ label: started ? "Open live tracker" : "Continue my order", url: publicUrl(`/order/${o.id}`) }],
  });
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
