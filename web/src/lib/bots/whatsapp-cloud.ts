import crypto from "node:crypto";
import { chatText, type BotMessage } from "./types";

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
  let text = chatText(msg.text, (t) => `*${t}*`);
  const opts = msg.options ?? [];
  const out: Record<string, unknown>[] = [];

  if (msg.multi && opts.length) {
    text += "\n\n" + opts.map((o, i) => `${i + 1}. ${o.label}`).join("\n") + "\n\n_Reply with all the numbers that apply, e.g. 1,3_";
    return [{ type: "text", text: { body: clip(text, 4096) } }];
  }
  const actionButtons = (msg.buttons ?? []).filter((b) => b.action);
  const links = (msg.buttons ?? []).filter((b) => b.url);
  if (links.length) text += "\n\n" + links.map((b) => `${b.label}: ${b.url}`).join("\n");

  // Interactive bodies are capped at 1024 chars: send long text first, then a short prompt with the buttons.
  const interactive = opts.length > 0 || actionButtons.length > 0;
  let body = text;
  if (interactive && text.length > 1000) {
    out.push({ type: "text", text: { body: clip(text, 4096) } });
    body = "Choose an option 👇";
  }
  if (opts.length && opts.length <= 3) {
    out.push({ type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: opts.map((o) => ({ type: "reply", reply: { id: `c:${o.value}`, title: clip(o.label, 20) } })) } } });
  } else if (opts.length) {
    out.push({
      type: "interactive",
      interactive: { type: "list", body: { text: body }, action: { button: "Choose", sections: [{ title: "Options", rows: opts.slice(0, 10).map((o) => ({ id: `c:${o.value}`, title: clip(o.label, 24) })) }] } },
    });
  } else if (actionButtons.length) {
    out.push({ type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: actionButtons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.action, title: clip(b.label, 20) } })) } } });
  } else {
    out.push({ type: "text", text: { body: clip(text, 4096), preview_url: false } });
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
