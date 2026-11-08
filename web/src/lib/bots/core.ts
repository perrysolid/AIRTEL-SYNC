import { advisorTurn, newSession } from "../advisor";
import type { AdvisorEvent } from "../advisor-types";
import { aiProviders } from "../ai";
import { transcribeAudio as geminiTranscribe } from "../gemini";
import { transcribeAudio as groqTranscribe } from "../groq";
import { transcribeAudio as sarvamTranscribe } from "../sarvam";
import { createOrder } from "../orders";
import { store, type AdvisorSession, type BotChat, type Order } from "../store";
import { liveDay, stepStatus } from "../tracker";
import { inr } from "../format";
import { featureTurn } from "./features";
import { contactKey, currentSession, latestOrder } from "./lookup";
import { publicUrl, type BotMessage } from "./types";
import { orderCardUrl, quoteCardUrl } from "../cards";
import { profileFromLead } from "../registry";
import { botLinks, startCode } from "../winback";

const LANG_CODE: Record<string, string> = { Hindi: "hi", Marathi: "mr", Tamil: "ta", Telugu: "te", Bengali: "bn", Gujarati: "gu", Kannada: "kn", Malayalam: "ml", Punjabi: "pa", English: "en" };

/** "Refer a business": a share message carrying this order's referral link. */
function referMessage(chat: BotChat, order: Order | undefined): BotMessage {
  if (!order) return { text: "📭 Once your services are live you can refer other business owners from here." };
  const links = botLinks(`REF-${order.id}`, "Hi Udyam, I was referred");
  const invite = `I set up internet, phones and billing for my business with Accel Business in minutes, right on WhatsApp — no visits, one bill. Try it: ${links.whatsapp}`;
  const share = chat.channel === "telegram" ? `https://t.me/share/url?url=${encodeURIComponent(links.telegram)}&text=${encodeURIComponent("Set up your business internet, phones and billing in minutes — no visits, one bill 👇")}` : `https://wa.me/?text=${encodeURIComponent(invite)}`;
  return {
    text: "🎁 **Know a business owner who'd love this?**\n\nShare your personal link. They get a plan in a minute, with no sales visit, and we'll know you sent them. 🙌",
    buttons: [{ label: "📤 Share my link", url: share }],
  };
}

/**
 * Channel-agnostic chat bot: the same advisor, ordering and order-status
 * brain behind WhatsApp (Cloud API or Twilio) and Telegram. Adapters only
 * translate updates in and BotMessages out.
 */

export interface BotInput {
  chat: BotChat;
  /** Typed text, a tapped option value ("type:Kirana store") or an action ("a:order"). */
  text: string;
  firstName?: string;
  /** Known for WhatsApp; Telegram only after the owner shares their contact. */
  phone?: string;
  language?: string;
}

export { currentSession };

export function statusMessage(order: Order): BotMessage {
  const t = order.timeline;
  const link = { label: "Open tracker", url: publicUrl(`/order/${order.id}`) };
  if (t.clockDay < 0) {
    const next = !order.kyc || order.kyc.result.verdict !== "verified" ? "verify your business (2 minutes, secure page)" : !order.esign ? "e-sign the agreement" : "complete the first payment";
    return { text: `📦 **Order ${order.id}**\n\n👉 Waiting for you to ${next}.`, image: orderCardUrl(order), buttons: [{ ...link, label: "Continue my order" }] };
  }
  const lines = t.tracks.map((tr) => {
    const nextStep = tr.steps.find((s) => stepStatus(s, t.clockDay) !== "done");
    return `${nextStep ? "⏳" : "✅"} ${tr.title}: ${nextStep ? `${nextStep.label} (day ${nextStep.dueDay})` : "live"}`;
  });
  return { text: `📦 **Order ${order.id}** · day ${t.clockDay} of ${liveDay(t)}\n\n${lines.join("\n")}`, image: orderCardUrl(order), buttons: [{ ...link, label: "Open live tracker" }] };
}

const HELP: BotMessage = {
  text: "🙏 Namaste! I'm **Udyam**, your Accel Business advisor.\n\nTell me about your business — type or send a 🎤 voice note, in any language — and in about a minute you'll get the right internet, phone and digital tools on **one monthly bill**.\n\n📦 **STATUS** — track your order\n🛡️ **SHIELD** — check a suspicious message\n📶 **NETWORK 411016** — is my area covered?\n🗓️ **SCHEDULE** — book your install slot\n🔧 **TROUBLE** — slow or no internet\n🏢 **BRANCH** — open a new location\n🔌 **BACKUP** — add a backup link\n🔄 **NEW** — start over\n📞 **HUMAN** — talk to a person",
};

function placeOrder(s: AdvisorSession, input: BotInput): BotMessage[] {
  if (!s.quote) return [{ text: "Let's find your plan first — what kind of business do you run?" }];
  const phone = input.phone ?? (input.chat.channel === "whatsapp" ? input.chat.chatId : undefined);
  if (!phone) {
    s.pendingOrder = true;
    store.saveSession(s);
    return [{ text: "🎉 Great choice! One last thing: share your mobile number so we can set up your account and send live activation updates here.", askContact: true }];
  }
  const o = createOrder(s, { contactName: input.firstName ?? "Owner", phone, botChat: input.chat });
  return [
    {
      text: `🎉 **You're in! Order ${o.id} is placed.**\n\n📦 ${o.lines.length} ${o.lines.length === 1 ? "service" : "services"} · **${inr(o.quote.monthlyWithGst)}/month** incl. GST · one bill\n\n👉 **Next:** verify your business on our secure page — about 2 minutes with DigiLocker or phone photos.\n\n🔔 Every update arrives right here. No calls, no chasing.`,
      image: orderCardUrl(o),
      buttons: [{ label: "Verify my business", url: publicUrl(`/order/${o.id}`) }],
    },
  ];
}

/** One inbound chat message → the replies to send back. */
export async function botTurn(input: BotInput): Promise<BotMessage[]> {
  const raw = input.text.trim();
  const cmd = raw.toLowerCase().replace(/^\//, "").split(/[\s@]/)[0];
  let s = currentSession(input.chat);

  if (["help", "menu"].includes(cmd)) return [HELP];
  if (["status", "track", "स्टेटस"].includes(cmd)) {
    const o = latestOrder(input.chat, input.phone ?? (input.chat.channel === "whatsapp" ? input.chat.chatId : undefined));
    return [o ? statusMessage(o) : { text: "📭 No order yet. Tell me about your business and I'll find the right plan in a minute." }];
  }
  // Scam Shield, Network check, scheduler, troubleshooter, Branch-in-a-Box, backup: handled before the advisor.
  const feature = await featureTurn(input, raw, cmd);
  if (feature) return feature;
  if (cmd === "new" || cmd === "restart") s = undefined;
  if (raw === "a:refer" || cmd === "refer") return [referMessage(input.chat, latestOrder(input.chat, input.phone ?? (input.chat.channel === "whatsapp" ? input.chat.chatId : undefined)))];

  // Personal links: a win-back lead code (L00042) or a referral (REF-ACC-…) starts a fresh, pre-filled chat.
  const code = startCode(raw);
  const prefix: BotMessage[] = [];
  let resumeNote = "";
  if (code.lead) {
    const found = profileFromLead(code.lead);
    if (found) {
      const { lead, profile } = found;
      s = newSession(input.chat.channel, LANG_CODE[lead.preferred_language] ?? "en");
      s.profile = { ...s.profile, ...profile };
      s.leadId = lead.lead_id;
      s.requestedProducts = lead.products_of_interest.split(";").filter(Boolean);
      store.saveSession(s);
      prefix.push({ text: `👋 **Welcome back, ${lead.business_name}!**\n\nNo visit, no waiting: I already have your details (${lead.business_type}, ${lead.city}, ${lead.employee_count} people). Here's your plan 👇` });
      resumeNote = "(The owner opened their personal link and has been welcomed already; their details are on file. Don't greet again or re-ask known facts. Recommend their plan now, in their language, and ask only what's still missing.)";
    }
  } else if (code.referral) {
    s = newSession(input.chat.channel, "en");
    s.referredBy = code.referral;
    store.saveSession(s);
    prefix.push({ text: "🎁 **Welcome to Accel Business!** A fellow business owner invited you. Let's find your plan — it takes about a minute." });
  }
  if (raw === "a:adjust") {
    if (!s?.quote) return [{ text: "⌛ That quote has expired. Tell me about your business again and I'll rebuild it in seconds." }];
    return [{ text: "✏️ Switch add-ons on or off, change quantities and pick a 12, 24 or 36-month term. The price updates as you tap.", buttons: [{ label: "Open my quote", url: publicUrl(`/quote/${s.id}`) }] }];
  }
  if (raw === "a:order" || (s?.pendingOrder && input.phone)) {
    if (s) return placeOrder(s, input);
    return [{ text: "⌛ That quote has expired. Tell me about your business again and I'll rebuild it in seconds." }];
  }

  let message = resumeNote || raw;
  if (!resumeNote && (["start", "new", "restart"].includes(cmd) || code.referral)) message = "";
  if (cmd === "human") message = "I want to talk to a person, please call me";
  if (message.startsWith("c:")) message = message.slice(2);

  const out: BotMessage[] = [...prefix];
  let text = "";
  let chips: BotMessage | undefined;
  let quoted = false;
  // A win-back lead is answered in the language the CRM says they prefer.
  const language = resumeNote && s ? s.language : input.language && /^(hi|mr|ta|te|bn|gu|kn|ml|pa|en)$/.test(input.language) ? input.language : /[ऀ-ॿ]/.test(message) ? "hi" : (s?.language ?? "en");

  const session = await advisorTurn({ sessionId: s?.id, message, channel: input.chat.channel, language }, (e: AdvisorEvent) => {
    if (e.type === "text") text += e.delta;
    if (e.type === "chips") chips = { text: "", options: e.options, multi: e.mode === "multi" };
    if (e.type === "bundle") quoted = true;
  });
  session.contactHash = contactKey(input.chat);
  session.botChat = input.chat;
  store.saveSession(session);

  const body = text.trim() || (chips ? "Please choose:" : "Sorry, could you say that again?");
  if (quoted && session.quote?.lines.some((l) => l.active && !l.blockedReason)) {
    out.push({
      text: body,
      image: quoteCardUrl(session),
      // WhatsApp reply buttons can't open links, so "Adjust" there replies with a link button.
      buttons: [
        { label: "✅ Order this plan", action: "a:order" },
        input.chat.channel === "whatsapp" ? { label: "✏️ Adjust plan", action: "a:adjust" } : { label: "✏️ Adjust plan", url: publicUrl(`/quote/${session.id}`) },
        { label: "📞 Talk to expert", action: "human" },
      ],
    });
  } else {
    out.push({ ...chips, text: body });
  }
  return out;
}

/** Voice notes: transcribe with Sarvam (or Gemini, Groq Whisper), then treat like typed text. */
export async function transcribeVoice(data: Buffer, mimeType: string): Promise<string | undefined> {
  for (const p of aiProviders()) {
    const transcribe = p === "sarvam" ? sarvamTranscribe : p === "groq" ? groqTranscribe : p === "gemini" ? geminiTranscribe : undefined;
    if (!transcribe) continue;
    try {
      const text = await transcribe(data, mimeType);
      if (text) return text;
    } catch (err) {
      console.warn(`[bot] ${p} voice transcription failed: ${(err as Error).message}`);
    }
  }
  return undefined;
}

export const VOICE_UNAVAILABLE: BotMessage = { text: "I couldn't listen to that voice note right now — please type your message instead. 🙏" };

export function documentRedirect(chat: BotChat): BotMessage {
  const o = latestOrder(chat);
  return {
    text: "🔒 For your privacy, I don't read documents in chat. Please upload them on our secure verification page — you'll see exactly what we use them for before anything is read.",
    buttons: o ? [{ label: "Verify my business", url: publicUrl(`/order/${o.id}`) }] : [],
  };
}
