import { notifyOrder } from "./notify";
import { newId, now, store, type AdvisorSession, type BotChat, type Order } from "./store";
import { buildTimeline } from "./tracker";

/** Turns an accepted quote into an order. KYC, e-sign and payment follow. */
export function createOrder(s: AdvisorSession, contact: { contactName: string; phone: string; partnerCode?: string; botChat?: BotChat }): Order {
  const existing = s.orderId ? store.getOrder(s.orderId) : undefined;
  if (existing) return existing;
  const quote = s.quote!;
  const active = quote.lines.filter((l) => l.active && !l.blockedReason);
  const id = newId("ord").toUpperCase().replace("ORD_", "ACC-");
  const order: Order = {
    id,
    sessionId: s.id,
    createdAt: now(),
    businessName: s.profile.businessName ?? s.profile.businessType ?? "Your business",
    city: s.profile.city,
    contactName: contact.contactName,
    phone: contact.phone.replace(/\D/g, "").slice(-10),
    channel: contact.partnerCode ? "partner" : s.channel,
    partnerCode: contact.partnerCode,
    profile: s.profile,
    lines: active,
    term: quote.term,
    quote,
    timeline: buildTimeline(active.map((l) => l.productId)),
    notifications: [],
    botChat: contact.botChat ?? s.botChat,
  };
  // The bot that took the order already confirms it in its own reply.
  if (contact.botChat) order.notifications.push({ at: now(), channel: contact.botChat.channel, text: `Order ${id} created.` });
  else notifyOrder(order, `Hi ${contact.contactName.split(" ")[0]}! Your Accel Business order ${id} is created. Next: verify your business (takes ~2 minutes). Track anytime: reply STATUS.`);
  store.saveOrder(order);
  s.orderId = id;
  s.status = "ordered";
  s.pendingOrder = undefined;
  store.saveSession(s);
  store.audit("owner", "order:create", id, `${active.length} lines, ₹${quote.monthly}/mo via ${order.channel}`);
  return order;
}
