import { now, type BotChat, type Order } from "./store";
import { sendTelegram, telegramEnabled } from "./bots/telegram";
import { sendWhatsApp, whatsappCloudEnabled } from "./bots/whatsapp-cloud";

/**
 * Records an owner update on the order and, when the order came from a chat
 * bot, delivers it to that chat. Delivery failures never block the journey.
 */
export function notifyOrder(o: Order, text: string) {
  o.notifications.push({ at: now(), channel: o.botChat?.channel ?? "whatsapp", text });
  if (o.botChat) void deliver(o.botChat, text);
}

export async function deliver(chat: BotChat, text: string) {
  if (!(chat.channel === "telegram" ? telegramEnabled() : whatsappCloudEnabled())) return;
  try {
    if (chat.channel === "telegram") await sendTelegram(chat.chatId, { text });
    else await sendWhatsApp(chat.chatId, { text });
  } catch (err) {
    console.warn(`[notify] ${chat.channel} delivery failed: ${(err as Error).message}`);
  }
}
