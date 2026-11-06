import crypto from "node:crypto";
import { advisorTurn } from "@/lib/advisor";
import type { AdvisorEvent } from "@/lib/advisor-types";
import { sha256 } from "@/lib/privacy";
import { store } from "@/lib/store";
import { liveDay, stepStatus } from "@/lib/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp front end via a Twilio WhatsApp webhook (sandbox works).
 * Same advisor brain as the web app; replies as TwiML. Also answers STATUS
 * for an existing order so owners never need to call support.
 */

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
const toWhatsApp = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/^#+\s*/gm, "").slice(0, 1550);

function statusReply(phoneDigits: string): string | undefined {
  const order = store.listOrders().filter((o) => o.phone === phoneDigits.slice(-10)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!order) return undefined;
  const t = order.timeline;
  if (t.clockDay < 0) {
    const next = !order.kyc || order.kyc.result.verdict !== "verified" ? "verify your business" : !order.esign ? "e-sign the agreement" : "complete the first payment";
    return `Order ${order.id}: waiting for you to ${next}. Continue here: ${process.env.PUBLIC_BASE_URL ?? ""}/order/${order.id}`;
  }
  const lines = t.tracks.map((tr) => {
    const done = tr.steps.filter((s) => stepStatus(s, t.clockDay) === "done").length;
    const nextStep = tr.steps.find((s) => stepStatus(s, t.clockDay) !== "done");
    return `${done === tr.steps.length ? "✅" : "⏳"} ${tr.title}: ${nextStep ? `${nextStep.label} (day ${nextStep.dueDay})` : "live"}`;
  });
  return `Order ${order.id} — day ${t.clockDay} of ${liveDay(t)}\n${lines.join("\n")}`;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  if (!validTwilioSignature(req, params)) return new Response("Invalid signature", { status: 403 });
  const from = params.get("From") ?? "";
  const body = (params.get("Body") ?? "").trim();
  const phone = from.replace(/\D/g, "");
  const key = sha256(from);

  let reply: string | undefined;
  if (/^(status|track|स्टेटस)$/i.test(body)) reply = statusReply(phone);
  if (!reply) {
    const existing = store.listSessions().find((s) => s.channel === "whatsapp" && s.contactHash === key && s.status !== "ordered");
    const language = /[ऀ-ॿ]/.test(body) ? "hi" : existing?.language ?? "en";
    let text = "";
    const s = await advisorTurn({ sessionId: existing?.id, message: body, channel: "whatsapp", language }, (e: AdvisorEvent) => {
      if (e.type === "text") text += e.delta;
      if (e.type === "chips" && e.mode === "single") text += "\n\n" + e.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
      if (e.type === "bundle") text += "";
    });
    s.contactHash = key;
    store.saveSession(s);
    if (s.quote) text += `\n\nSee and adjust your quote: ${process.env.PUBLIC_BASE_URL ?? ""}/quote/${s.id}`;
    reply = text || "Sorry, please try again.";
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(toWhatsApp(reply))}</Message></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
