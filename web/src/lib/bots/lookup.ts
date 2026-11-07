import { sha256 } from "../privacy";
import { store, type AdvisorSession, type BotChat, type Order } from "../store";

/** Stable, non-reversible key for one chat (we never store the raw WhatsApp/Telegram id as a lookup key). */
export const contactKey = (chat: BotChat) => sha256(`${chat.channel}:${chat.chatId}`);

/** The most recent order placed from this chat (or by this phone number). */
export function latestOrder(chat: BotChat, phone?: string): Order | undefined {
  return store
    .listOrders()
    .filter((o) => (o.botChat?.channel === chat.channel && o.botChat.chatId === chat.chatId) || (phone && o.phone === phone.replace(/\D/g, "").slice(-10)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** The open (not yet ordered) advisor session for this chat, newest first. */
export function currentSession(chat: BotChat): AdvisorSession | undefined {
  const key = contactKey(chat);
  return store
    .listSessions()
    .filter((s) => s.contactHash === key && s.status !== "ordered")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
