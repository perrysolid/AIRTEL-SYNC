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
    return { text: `**Order ${order.id}**\nWaiting for you to ${next}.`, image: orderCardUrl(order), buttons: [{ ...link, label: "Continue my order" }] };
  }
  const lines = t.tracks.map((tr) => {
    const nextStep = tr.steps.find((s) => stepStatus(s, t.clockDay) !== "done");
    return `${nextStep ? "⏳" : "✅"} ${tr.title}: ${nextStep ? `${nextStep.label} (day ${nextStep.dueDay})` : "live"}`;
  });
  return { text: `**Order ${order.id}** — day ${t.clockDay} of ${liveDay(t)}\n${lines.join("\n")}`, image: orderCardUrl(order), buttons: [link] };
}

const HELP: BotMessage = {
  text: "I'm Udyam, Accel Business's advisor. Tell me about your business in any language — or send a voice note — and I'll suggest the right internet, phone and digital tools with one monthly price.\n\n**STATUS** — track your order\n**NEW** — start over\n**HUMAN** — talk to a person",
};

function placeOrder(s: AdvisorSession, input: BotInput): BotMessage[] {
  if (!s.quote) return [{ text: "Let's find your plan first — what kind of business do you run?" }];
  const phone = input.phone ?? (input.chat.channel === "whatsapp" ? input.chat.chatId : undefined);
  if (!phone) {
    s.pendingOrder = true;
    store.saveSession(s);
    return [{ text: "Great! Please share your mobile number so we can send activation updates and set up your account.", askContact: true }];
  }
  const o = createOrder(s, { contactName: input.firstName ?? "Owner", phone, botChat: input.chat });
  return [
    {
      text: `✅ **Order ${o.id} created** — ${o.lines.length} services for **${inr(o.quote.monthlyWithGst)}/month** incl. GST.\n\nNext: verify your business on our secure page (about 2 minutes — DigiLocker or photos). I'll send every update right here, so there's no need to call us.`,
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
    return [o ? statusMessage(o) : { text: "You don't have an order yet. Tell me about your business and I'll find the right plan." }];
  }
  if (cmd === "new" || cmd === "restart") s = undefined;
  if (raw === "a:order" || (s?.pendingOrder && input.phone)) {
    if (s) return placeOrder(s, input);
    return [{ text: "That quote has expired — tell me about your business again and I'll rebuild it." }];
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
  if (quoted && session.quote) {
    out.push({
      text: body,
      image: quoteCardUrl(session),
      buttons: [
        { label: "See & adjust my quote", url: publicUrl(`/quote/${session.id}`) },
        { label: "✅ Order this plan", action: "a:order" },
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
