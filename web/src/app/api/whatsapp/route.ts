import crypto from "node:crypto";
import { after } from "next/server";
import { botTurn, documentRedirect, transcribeVoice, VOICE_UNAVAILABLE } from "@/lib/bots/core";
import { downloadWhatsAppMedia, markReadTyping, sendWhatsApp, validMetaSignature } from "@/lib/bots/whatsapp-cloud";
import type { BotMessage } from "@/lib/bots/types";
import { asPlainText } from "@/lib/bots/types";
import { noteWhatsAppInbound } from "@/lib/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp front end. Two transports share one bot brain:
 *  - WhatsApp Cloud API (Meta): JSON webhooks, replies via the Graph API with
 *    native reply buttons and lists.
 *  - Twilio (form-encoded, TwiML replies) — also used by the /whatsapp simulator.
 */

/** Meta webhook verification handshake. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get("hub.challenge") ?? "") : new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if ((req.headers.get("content-type") ?? "").includes("application/json")) return cloudWebhook(req, raw);
  return twilioWebhook(req, raw);
}

// ---------------------------------------------------------------------------
// Meta WhatsApp Cloud API
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
const g = globalThis as unknown as { __waSeen?: Set<string> };
const seen = (g.__waSeen ??= new Set());

async function cloudWebhook(req: Request, raw: string) {
  if (!validMetaSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw);
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const name = value.contacts?.[0]?.profile?.name;
      for (const m of value.messages ?? []) {
        if (seen.has(m.id)) continue; // Meta retries deliveries
        seen.add(m.id);
        after(() => handleCloudMessage(m, name).catch((err) => console.error("[whatsapp]", err)));
      }
    }
  }
  return new Response("OK"); // acknowledge fast; replies go out via the Graph API
}

async function handleCloudMessage(m: any, name?: string) {
  const to: string = m.from;
  const chat = { channel: "whatsapp" as const, chatId: to };
  const base = { chat, firstName: name?.split(" ")[0], phone: to };
  noteWhatsAppInbound(to);
  await markReadTyping(m.id);
  const send = async (msgs: BotMessage[]) => {
    try {
      for (const msg of msgs) await sendWhatsApp(to, msg);
    } catch (err) {
      // Meta's test number only replies to its allowed list (up to 5 numbers): say so plainly in the logs.
      if (/131030|allowed list/i.test((err as Error).message)) console.warn(`[whatsapp] reply to ${to.slice(0, 4)}•••• not delivered: not on the test number's allowed list`);
      else throw err;
    }
  };

  switch (m.type) {
    case "text":
      return send(await botTurn({ ...base, text: m.text.body }));
    case "interactive": {
      const id = m.interactive.button_reply?.id ?? m.interactive.list_reply?.id ?? "";
      return send(await botTurn({ ...base, text: id }));
    }
    case "button": // quick-reply on a template message
      return send(await botTurn({ ...base, text: m.button.payload ?? m.button.text }));
    case "audio": {
      const media = await downloadWhatsAppMedia(m.audio.id);
      const transcript = await transcribeVoice(media.data, media.mimeType);
      if (!transcript) return send([VOICE_UNAVAILABLE]);
      return send([{ text: `🎙️ _${transcript}_` }, ...(await botTurn({ ...base, text: transcript }))]);
    }
    case "image":
    case "document":
      return send([documentRedirect(chat)]);
    default:
      return send([{ text: "Sorry, I can read text, voice notes and button taps. Type HELP to see what I can do." }]);
  }
}

// ---------------------------------------------------------------------------
// Twilio (sandbox) and the built-in simulator
// ---------------------------------------------------------------------------

function validTwilioSignature(req: Request, params: URLSearchParams): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // local/demo mode
  const url = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/api/whatsapp` : req.url;
  const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join("");
  const expected = crypto.createHmac("sha1", token).update(data).digest("base64");
  const got = req.headers.get("x-twilio-signature") ?? "";
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function twilioWebhook(req: Request, raw: string) {
  const params = new URLSearchParams(raw);
  if (!validTwilioSignature(req, params)) return new Response("Invalid signature", { status: 403 });
  const from = (params.get("From") ?? "").replace(/\D/g, "");
  let body = (params.get("Body") ?? "").trim();
  if (/^order$/i.test(body)) body = "a:order";
  const msgs = await botTurn({ chat: { channel: "whatsapp", chatId: from }, text: body, phone: from, firstName: params.get("ProfileName")?.split(" ")[0] });
  const reply = msgs.map(asPlainText).join("\n\n").slice(0, 1550);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(reply)}</Message></Response>`, { headers: { "Content-Type": "text/xml" } });
}
