import { liveDay } from "./tracker";
import { quoteCardUrl } from "./cards";
import { notifyOrder, deliver } from "./notify";
import { store, now, type AdvisorSession, type Order } from "./store";
import type { BotButton } from "./bots/types";

/**
 * One gentle reminder per stall, in the chat the owner used: a saved plan
 * nobody ordered, or an order waiting on the owner (KYC, e-sign, first
 * payment). Only inside WhatsApp's 24-hour customer-service window, which is
 * all a business may message without an approved template.
 */

const minutes = (name: string, fallback: number) => Number(process.env[name] ?? fallback) * 60_000;
const WINDOW = 23 * 3600_000; // stay safely inside the 24 h window

function lastOwnerMessage(s?: AdvisorSession) {
  const at = s?.transcript.filter((m) => m.role === "user").at(-1)?.at ?? s?.updatedAt;
  return at ? Date.parse(at) : 0;
}

export function waitingStep(o: Order): "kyc" | "esign" | "pay" | undefined {
  if (o.payment) return undefined;
  if (o.kyc?.result.verdict !== "verified") return "kyc";
  if (!o.esign) return "esign";
  // Installation runs without the owner; only a first bill left unpaid after go-live needs a reminder.
  return o.timeline.clockDay >= liveDay(o.timeline) ? "pay" : undefined;
}

const ORDER_NUDGE = {
  kyc: "⏳ **One quick step and we start activating.**\n\nVerify your business on our secure page: about 2 minutes with DigiLocker or phone photos. 🔒 Your documents are checked, never stored.",
  esign: "✍️ **You're verified! Just sign and installation starts.**\n\nSign your agreement in 30 seconds. Nothing to pay until your services are live.",
  pay: "🧾 **Your first bill is ready.**\n\nEverything is live. Pay by UPI in your tracker, and turn on AutoPay so you never have to think about it again.",
};

export async function runNudges(at = Date.now()) {
  const quoteAfter = minutes("NUDGE_QUOTE_MINUTES", 120);
  const orderAfter = minutes("NUDGE_ORDER_MINUTES", 120);
  const sent: string[] = [];

  for (const s of store.listSessions()) {
    if (!s.botChat || s.status !== "quoted" || s.orderId || s.nudgedAt || !s.quote) continue;
    const idle = at - Date.parse(s.updatedAt);
    if (idle < quoteAfter || at - lastOwnerMessage(s) > WINDOW) continue;
    s.nudgedAt = now();
    store.saveSession(s);
    const who = s.profile.businessName ?? s.profile.businessType ?? "your business";
    const buttons: BotButton[] = [
      { label: "✅ Order this plan", action: "a:order" },
      { label: "✏️ Adjust plan", action: "a:adjust" },
      { label: "📞 Talk to expert", action: "human" },
    ];
    await deliver(s.botChat, {
      text: `💡 **Your plan for ${who} is saved.**\n\nPrices are locked for you today. Order in one tap, or tell me what to change, like "remove CCTV" or "keep it under ₹3,000".`,
      image: quoteCardUrl(s),
      buttons,
    });
    sent.push(s.id);
  }

  for (const o of store.listOrders()) {
    const step = waitingStep(o);
    if (!o.botChat || !step || o.nudges?.[step]) continue;
    const lastUpdate = Date.parse(o.notifications.at(-1)?.at ?? o.createdAt);
    const session = o.sessionId ? store.getSession(o.sessionId) : undefined;
    if (at - lastUpdate < orderAfter || at - lastOwnerMessage(session) > WINDOW) continue;
    o.nudges = { ...o.nudges, [step]: now() };
    notifyOrder(o, ORDER_NUDGE[step]);
    store.saveOrder(o);
    sent.push(o.id);
  }
  return sent;
}
