import crypto from "node:crypto";
import { NEED_LABELS, type Profile } from "./profile";
import { now, store, type AdvisorSession, type Customer, type Order } from "./store";

/**
 * Customer accounts and memory. A customer signs in with their mobile number
 * (OTP); everything they tell the advisor is merged into one profile that the
 * next conversation starts from, on any channel, and order updates follow
 * them to WhatsApp and Telegram.
 */

/** Indian mobile in any common form ("+91 98765 43210", "09876543210") → 91XXXXXXXXXX, or undefined. */
export function normalizePhone(input: string): string | undefined {
  const d = input.replace(/\D/g, "").replace(/^0+/, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 10 ? d : undefined;
  return ten && /^[6-9]\d{9}$/.test(ten) ? `91${ten}` : undefined;
}

export const maskPhone = (phone: string) => `+91 ••••• ${phone.slice(-5)}`;

const idFor = (phone: string) => "cus_" + crypto.createHash("sha256").update(`accel-customer:${phone}`).digest("hex").slice(0, 16);

export const customerByPhone = (phone: string) => store.getCustomer(idFor(phone));

/** "Continue with demo": a private, throwaway account pre-filled like a returning kirana owner, so the personalised experience shows at once. */
export function startDemoCustomer(sessionId?: string): Customer {
  const hex = crypto.randomBytes(8).toString("hex");
  const c: Customer = {
    id: `cus_${hex}`,
    phone: `demo-${hex}`,
    name: "Ramesh",
    demo: true,
    createdAt: now(),
    lastSeenAt: now(),
    language: "en",
    profile: { businessName: "Sharma Kirana", businessType: "Kirana store", city: "Indore", employees: 2, hasGstin: true, currentInternet: "Mobile hotspot", monthlySpend: 700, needs: ["pos_billing", "backup_internet"] },
    requestedProducts: [],
    declinedProducts: [],
    sessionIds: [],
    orderIds: [],
    notify: { whatsapp: false, telegram: true },
  };
  const s = sessionId ? store.getSession(sessionId) : undefined;
  if (s && !s.customerId) {
    s.customerId = c.id;
    store.saveSession(s);
    rememberSession(c, s, false);
  }
  store.saveCustomer(c);
  store.audit("customer", "customer:demo", c.id, "demo");
  return c;
}

/** Creates the account on first sign-in, and attaches orders already placed with this number. */
export function signInCustomer(phone: string, opts: { name?: string; sessionId?: string; language?: string } = {}): Customer {
  const existing = customerByPhone(phone);
  const c: Customer = existing ?? {
    id: idFor(phone),
    phone,
    createdAt: now(),
    lastSeenAt: now(),
    profile: { needs: [] },
    requestedProducts: [],
    declinedProducts: [],
    sessionIds: [],
    orderIds: [],
    notify: { whatsapp: true, telegram: true },
  };
  c.lastSeenAt = now();
  if (opts.name?.trim()) c.name = opts.name.trim().slice(0, 60);
  if (opts.language) c.language = opts.language;
  for (const o of store.listOrders()) if (o.phone && `91${o.phone}` === phone && !c.orderIds.includes(o.id)) c.orderIds.push(o.id);
  // The conversation they had before signing in becomes part of their memory.
  const s = opts.sessionId ? store.getSession(opts.sessionId) : undefined;
  if (s && (!s.customerId || s.customerId === c.id)) {
    s.customerId = c.id;
    store.saveSession(s);
    rememberSession(c, s, false);
  }
  if (!c.name) c.name = firstOrderName(c);
  store.saveCustomer(c);
  store.audit("customer", existing ? "customer:sign-in" : "customer:create", c.id, maskPhone(phone));
  return c;
}

function firstOrderName(c: Customer) {
  return c.orderIds.map((id) => store.getOrder(id)?.contactName).find(Boolean)?.split(" ")[0];
}

/** Merges what a conversation learned into the customer's memory. Newer facts win; needs accumulate. */
export function rememberSession(c: Customer, s: AdvisorSession, save = true) {
  const p = s.profile;
  const merged: Profile = { ...c.profile };
  for (const [k, v] of Object.entries(p) as [keyof Profile, unknown][]) {
    if (k === "needs" || v === undefined || v === null || v === "") continue;
    (merged as Record<string, unknown>)[k] = v;
  }
  merged.needs = [...new Set([...(c.profile.needs ?? []), ...(p.needs ?? [])])];
  c.profile = merged;
  c.language = s.language || c.language;
  c.requestedProducts = [...new Set([...c.requestedProducts, ...s.requestedProducts])];
  c.declinedProducts = [...new Set([...c.declinedProducts.filter((x) => !s.requestedProducts.includes(x)), ...s.declinedProducts])];
  if (!c.sessionIds.includes(s.id)) c.sessionIds.push(s.id);
  if (s.quote) {
    c.lastPlan = {
      monthly: s.quote.monthly,
      monthlyWithGst: s.quote.monthlyWithGst,
      term: s.quote.term,
      lines: s.quote.lines.filter((l) => l.active && !l.blockedReason).map((l) => l.name),
      at: now(),
      sessionId: s.id,
    };
  }
  if (s.orderId && !c.orderIds.includes(s.orderId)) c.orderIds.push(s.orderId);
  c.lastSeenAt = now();
  if (save) store.saveCustomer(c);
}

/** The customer, if the order was placed with a number someone has verified by OTP. */
export function customerForOrder(o: Order): Customer | undefined {
  const c = o.phone ? customerByPhone(`91${o.phone}`) : undefined;
  if (c && !c.orderIds.includes(o.id)) {
    c.orderIds.push(o.id);
    store.saveCustomer(c);
  }
  return c;
}

/** A few lines the advisor reads at the start of a conversation, so it never re-asks what it already knows. */
export function memoryBrief(c: Customer): string {
  const p = c.profile;
  const facts = [
    c.name && `Name: ${c.name}`,
    (p.businessName || p.businessType) && `Business: ${[...new Set([p.businessName, p.businessType].filter(Boolean))].join(", ")}`,
    p.city && `City: ${p.city}`,
    p.employees && `Team: ${p.employees} people`,
    p.sites && p.sites > 1 && `Sites: ${p.sites}`,
    p.hasGstin !== undefined && `GST registered: ${p.hasGstin ? "yes" : "no"}`,
    p.currentInternet && `Internet today: ${p.currentInternet}`,
    p.monthlySpend && `Pays today: ₹${p.monthlySpend}/month`,
    p.budget && `Budget: up to ₹${p.budget}/month`,
    p.needs?.length && `Needs: ${p.needs.map((n) => needLabel(n)).join("; ")}`,
    c.declinedProducts.length && `Said no to: ${c.declinedProducts.join(", ")}`,
    c.lastPlan && `Last plan we priced: ${c.lastPlan.lines.join(", ")} at ₹${c.lastPlan.monthly}/month + GST (${c.lastPlan.term} months)`,
    c.orderIds.length && `Orders: ${c.orderIds.map((id) => orderLine(id)).join("; ")}`,
  ].filter(Boolean);
  if (!facts.length) return "";
  return `This owner is signed in and has spoken to us before. What we remember (confirm anything that may have changed instead of asking again; greet them by name; refer to their last plan or order when it helps):\n- ${facts.join("\n- ")}`;
}

const needLabel = (n: string) => NEED_LABELS[n as keyof typeof NEED_LABELS] ?? n;

function orderLine(id: string) {
  const o = store.getOrder(id);
  if (!o) return id;
  const stage = o.payment ? "paid, activation in progress" : o.esign ? "signed, payment pending" : o.kyc ? "verified, signature pending" : "verification pending";
  return `${id} (${stage})`;
}

/** A WhatsApp message from this number opens 24 hours in which we may send free-form updates. */
export function noteWhatsAppInbound(from: string) {
  const c = customerByPhone(normalizePhone(from) ?? "");
  if (!c) return;
  c.whatsappInboundAt = now();
  store.saveCustomer(c);
}

/** Connects a Telegram chat to the account (from the deep link on the account page). */
export function linkTelegram(customerId: string, chatId: string): Customer | undefined {
  const c = store.getCustomer(customerId);
  if (!c) return undefined;
  c.telegramChatId = chatId;
  c.notify.telegram = true;
  store.saveCustomer(c);
  store.audit("customer", "customer:telegram-link", c.id, "");
  return c;
}

/** The signed-in customer behind a bot chat: their verified WhatsApp number, or their linked Telegram chat. */
export function customerForChat(chat: { channel: "whatsapp" | "telegram"; chatId: string }): Customer | undefined {
  if (chat.channel === "whatsapp") return customerByPhone(normalizePhone(chat.chatId) ?? "");
  return store.listCustomers().find((c) => c.telegramChatId === chat.chatId);
}

/** Profile fields worth carrying into a new conversation as known facts. */
export function seedProfile(c: Customer): Profile {
  return { ...c.profile, needs: [...(c.profile.needs ?? [])] };
}
