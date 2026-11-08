import crypto from "node:crypto";
import { chatText, linkButtonsAllowed, type BotMessage } from "./types";
import { cardPng, stageImage } from "../media";

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

/** A card already uploaded to WhatsApp (delivered instantly) or a public link Meta fetches. */
export type WaMedia = { id: string } | { link: string };

export function payloads(msg: BotMessage, media?: WaMedia): Record<string, unknown>[] {
  const text = chatText(msg.text, (t) => `*${t}*`);
  const opts = msg.options ?? [];
  const actions = (msg.buttons ?? []).filter((b) => b.action);
  const links = (msg.buttons ?? []).filter((b) => b.url);
  const img = media ?? (msg.image && linkButtonsAllowed() ? { link: msg.image } : undefined);
  const out: Record<string, unknown>[] = [];
  let body = text;

  if (msg.multi && opts.length) {
    const list = opts.map((o, i) => `${i + 1}. ${o.label}`).join("\n") + "\n\n_Reply with all the numbers that apply, e.g. 1,3_";
    const all = body ? `${body}\n\n${list}` : list;
    if (img && all.length <= 1024) return [{ type: "image", image: { ...img, caption: all } }];
    if (img) out.push({ type: "image", image: img });
    out.push({ type: "text", text: { body: clip(all, 4096) } });
    return out;
  }

  const buttons = opts.length > 0 && opts.length <= 3 ? opts.map((o) => ({ id: `c:${o.value}`, title: o.label })) : !opts.length ? actions.slice(0, 3).map((b) => ({ id: b.action!, title: b.label })) : [];
  // A lone link becomes a native "open" button; otherwise links go inline.
  const cta = !opts.length && !actions.length && links.length === 1 && linkButtonsAllowed() ? links[0] : undefined;
  if (!cta && links.length) {
    const linkText = links.map((b) => `${b.label}: ${b.url}`).join("\n");
    body = body ? `${body}\n\n${linkText}` : linkText;
  }

  // Card, text and buttons as ONE message (image header), so nothing arrives out of order.
  const header = img ? { header: { type: "image", image: img } } : {};
  const fits = body.length <= 1024;
  if (img && fits && buttons.length) {
    return [{ type: "interactive", interactive: { type: "button", ...header, body: { text: body || "👇" }, action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.title, 20) } })) } } }];
  }
  if (img && fits && cta) {
    return [{ type: "interactive", interactive: { type: "cta_url", ...header, body: { text: body || "👇" }, action: { name: "cta_url", parameters: { display_text: clip(cta.label, 20), url: cta.url } } } }];
  }
  // Otherwise the card goes first, carrying the text as its caption when it fits.
  if (img) {
    out.push({ type: "image", image: fits && body ? { ...img, caption: body } : img });
    if (fits) body = "";
  }

  // Interactive bodies are capped at 1024 chars: send long text first, then a short prompt with the buttons.
  if ((opts.length || actions.length || cta) && body.length > 1000) {
    out.push({ type: "text", text: { body: clip(body, 4096) } });
    body = "";
  }
  const prompt = body || (opts.length ? "Choose an option 👇" : "Tap below 👇");
  if (buttons.length) {
    out.push({ type: "interactive", interactive: { type: "button", body: { text: prompt }, action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.title, 20) } })) } } });
  } else if (opts.length) {
    out.push({
      type: "interactive",
      interactive: { type: "list", body: { text: prompt }, action: { button: "Choose", sections: [{ title: "Options", rows: opts.slice(0, 10).map((o) => ({ id: `c:${o.value}`, title: clip(o.label, 24) })) }] } },
    });
  } else if (cta) {
    out.push({ type: "interactive", interactive: { type: "cta_url", body: { text: prompt }, action: { name: "cta_url", parameters: { display_text: clip(cta.label, 20), url: cta.url } } } });
  } else if (body) {
    out.push({ type: "text", text: { body: clip(body, 4096), preview_url: false } });
  }
  return out;
}

const uploaded = new Map<string, string>();

/** Uploads the card to WhatsApp so the message carries a media id and arrives at once. */
async function whatsappMedia(msg: BotMessage): Promise<WaMedia | undefined> {
  if (!msg.image) return undefined;
  try {
    const card = await cardPng(msg.image);
    if (card) {
      let id = uploaded.get(card.key);
      if (!id) {
        const form = new FormData();
        form.append("messaging_product", "whatsapp");
        form.append("type", "image/png");
        form.append("file", new Blob([card.bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }), "card.png");
        const r = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }, body: form, signal: AbortSignal.timeout(20_000) });
        const j = await r.json();
        if (!r.ok || !j.id) throw new Error(j.error?.message ?? r.statusText);
        id = j.id as string;
        uploaded.set(card.key, id);
      }
      return { id };
    }
  } catch (e) {
    console.warn(`[whatsapp] card upload failed, sending a link: ${(e as Error).message}`);
  }
  // Fallback: a stored copy (Neon) or the app URL, which Meta fetches itself.
  const staged = await stageImage(msg);
  return staged.image && (linkButtonsAllowed() || staged.image !== msg.image) ? { link: staged.image } : undefined;
}

export async function sendWhatsApp(to: string, msg: BotMessage) {
  for (const p of payloads(msg, await whatsappMedia(msg))) {
    await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { messaging_product: "whatsapp", recipient_type: "individual", to, ...p });
  }
}

/**
 * A pre-approved template, the only kind of message WhatsApp delivers more than
 * 24 hours after the customer last wrote to us. Parameters can't contain line
 * breaks, so multi-line updates are joined.
 */
export async function sendWhatsAppTemplate(to: string, name: string, params: string[], language = process.env.WHATSAPP_TEMPLATE_LANG ?? "en") {
  const text = (v: string) => clip(v.replace(/\s*\n+\s*/g, " · ").replace(/\s{4,}/g, "   "), 900);
  await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name, language: { code: language }, components: params.length ? [{ type: "body", parameters: params.map((v) => ({ type: "text", text: text(v) })) }] : [] },
  });
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
