import crypto from "node:crypto";
import { chatText, linkButtonsAllowed, type BotMessage } from "./types";

/** WhatsApp Cloud API (Meta Graph) client: interactive buttons, lists and CTA links. */

const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0"}`;

export function whatsappCloudEnabled() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function graph<T = unknown>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const r = await fetch(`${GRAPH()}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${j.error?.message ?? r.statusText}`);
  return j as T;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function payloads(msg: BotMessage): Record<string, unknown>[] {
  const text = chatText(msg.text, (t) => `*${t}*`);
  const opts = msg.options ?? [];
  const actions = (msg.buttons ?? []).filter((b) => b.action);
  const links = (msg.buttons ?? []).filter((b) => b.url);
  const out: Record<string, unknown>[] = [];

  // Card first (Meta fetches it by URL, so it must be public https); the text rides as its caption.
  let body = text;
  if (msg.image && linkButtonsAllowed()) {
    out.push({ type: "image", image: { link: msg.image, caption: clip(text, 1024) } });
    body = "";
  }

  if (msg.multi && opts.length) {
    const list = opts.map((o, i) => `${i + 1}. ${o.label}`).join("\n") + "\n\n_Reply with all the numbers that apply, e.g. 1,3_";
    out.push({ type: "text", text: { body: clip(body ? `${body}\n\n${list}` : list, 4096) } });
    return out;
  }

  const interactive = opts.length > 0 || actions.length > 0;
  // A lone link becomes a native "open" button; otherwise links go inline.
  const cta = !interactive && links.length === 1 && linkButtonsAllowed() ? links[0] : undefined;
  if (!cta && links.length) {
    const linkText = links.map((b) => `${b.label}: ${b.url}`).join("\n");
    body = body ? `${body}\n\n${linkText}` : linkText;
  }

  // Interactive bodies are capped at 1024 chars: send long text first, then a short prompt with the buttons.
  if ((interactive || cta) && body.length > 1000) {
    out.push({ type: "text", text: { body: clip(body, 4096) } });
    body = "";
  }
  const prompt = body || (opts.length ? "Choose an option 👇" : "Tap below 👇");
  if (opts.length && opts.length <= 3) {
    out.push({ type: "interactive", interactive: { type: "button", body: { text: prompt }, action: { buttons: opts.map((o) => ({ type: "reply", reply: { id: `c:${o.value}`, title: clip(o.label, 20) } })) } } });
  } else if (opts.length) {
    out.push({
      type: "interactive",
      interactive: { type: "list", body: { text: prompt }, action: { button: "Choose", sections: [{ title: "Options", rows: opts.slice(0, 10).map((o) => ({ id: `c:${o.value}`, title: clip(o.label, 24) })) }] } },
    });
  } else if (actions.length) {
    out.push({ type: "interactive", interactive: { type: "button", body: { text: prompt }, action: { buttons: actions.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.action, title: clip(b.label, 20) } })) } } });
  } else if (cta) {
    out.push({ type: "interactive", interactive: { type: "cta_url", body: { text: prompt }, action: { name: "cta_url", parameters: { display_text: clip(cta.label, 20), url: cta.url } } } });
  } else if (body) {
    out.push({ type: "text", text: { body: clip(body, 4096), preview_url: false } });
  }
  return out;
}

export async function sendWhatsApp(to: string, msg: BotMessage) {
  for (const p of payloads(msg)) {
    await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { messaging_product: "whatsapp", recipient_type: "individual", to, ...p });
  }
}

/** Blue ticks plus a typing indicator while the advisor thinks. */
export async function markReadTyping(messageId: string) {
  await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } }).catch(() => {});
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string }> {
  const meta = await graph<{ url: string; mime_type: string }>(mediaId, undefined, "GET");
  const r = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
  return { data: Buffer.from(await r.arrayBuffer()), mimeType: meta.mime_type };
}

/** Meta signs webhook bodies with the app secret (X-Hub-Signature-256). */
export function validMetaSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // local/demo mode
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const got = header ?? "";
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
