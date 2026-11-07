import { advisorTurn } from "../advisor";
import type { AdvisorEvent } from "../advisor-types";
import { aiProviders } from "../ai";
import { transcribeAudio as geminiTranscribe } from "../gemini";
import { transcribeAudio as groqTranscribe } from "../groq";
import { createOrder } from "../orders";
import { sha256 } from "../privacy";
import { store, type AdvisorSession, type BotChat, type Order } from "../store";
import { liveDay, stepStatus } from "../tracker";
import { inr } from "../format";
import { publicUrl, type BotMessage } from "./types";
import { orderCardUrl, quoteCardUrl } from "../cards";

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

const contactKey = (chat: BotChat) => sha256(`${chat.channel}:${chat.chatId}`);

export function currentSession(chat: BotChat): AdvisorSession | undefined {
  const key = contactKey(chat);
  return store
    .listSessions()
    .filter((s) => s.contactHash === key && s.status !== "ordered")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

function latestOrder(chat: BotChat, phone?: string): Order | undefined {
  return store
    .listOrders()
    .filter((o) => (o.botChat?.channel === chat.channel && o.botChat.chatId === chat.chatId) || (phone && o.phone === phone.replace(/\D/g, "").slice(-10)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

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
  text: "🙏 Namaste! I'm **Udyam**, your Accel Business advisor.\n\nTell me about your business — type or send a 🎤 voice note, in any language — and in about a minute you'll get the right internet, phone and digital tools on **one monthly bill**.\n\n📦 **STATUS** — track your order\n🔄 **NEW** — start over\n📞 **HUMAN** — talk to a person",
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
  if (cmd === "new" || cmd === "restart") s = undefined;
  if (raw === "a:adjust") {
    if (!s?.quote) return [{ text: "⌛ That quote has expired. Tell me about your business again and I'll rebuild it in seconds." }];
    return [{ text: "✏️ Switch add-ons on or off, change quantities and pick a 12, 24 or 36-month term. The price updates as you tap.", buttons: [{ label: "Open my quote", url: publicUrl(`/quote/${s.id}`) }] }];
  }
  if (raw === "a:order" || (s?.pendingOrder && input.phone)) {
    if (s) return placeOrder(s, input);
    return [{ text: "⌛ That quote has expired. Tell me about your business again and I'll rebuild it in seconds." }];
  }

  let message = raw;
  if (["start", "new", "restart"].includes(cmd)) message = "";
  if (cmd === "human") message = "I want to talk to a person, please call me";
  if (message.startsWith("c:")) message = message.slice(2);

  const out: BotMessage[] = [];
  let text = "";
  let chips: BotMessage | undefined;
  let quoted = false;
  const language = input.language && /^(hi|mr|ta|te|bn|gu|kn|ml|pa|en)$/.test(input.language) ? input.language : /[ऀ-ॿ]/.test(message) ? "hi" : (s?.language ?? "en");

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

/** Voice notes: transcribe with Gemini (or Groq Whisper), then treat like typed text. */
export async function transcribeVoice(data: Buffer, mimeType: string): Promise<string | undefined> {
  for (const p of aiProviders()) {
    const transcribe = p === "groq" ? groqTranscribe : p === "gemini" ? geminiTranscribe : undefined;
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
