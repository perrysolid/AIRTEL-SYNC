import { z } from "zod";
import { newSession } from "@/lib/advisor";
import { maskPhone } from "@/lib/privacy";
import { now, store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHEN = ["Now", "Within 2 hours", "This evening", "Tomorrow morning"] as const;
const Body = z.object({
  phone: z.string().transform((s) => s.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "")).pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number")),
  name: z.string().trim().max(60).optional(),
  when: z.enum(WHEN).default("Within 2 hours"),
  language: z.string().max(5).default("en"),
});

// a few requests per hour from one address, so the form can't be used to flood the call queue
const g = globalThis as unknown as { __callbackHits?: Map<string, number[]> };
const hits = (g.__callbackHits ??= new Map<string, number[]>());

/**
 * "Request a call": the owner leaves a number and a time; it joins the advisor hand-off queue that the console and
 * staff portal already work from, marked as a call-back. The number is kept for the caller and masked everywhere else.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const recent = (hits.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
  if (recent.length >= 5) return Response.json({ error: "We already have your request. An advisor will call you soon." }, { status: 429 });
  hits.set(ip, [...recent, Date.now()]);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Please check your details." }, { status: 400 });
  const { phone, name, when, language } = parsed.data;

  const s = newSession("web", language);
  s.status = "handoff";
  s.callback = { phone: `91${phone}`, name: name || undefined, when, at: now() };
  s.handoff = { reason: `Asked for a call back (${when.toLowerCase()})`, at: now(), summary: `${name ? `${name}, ` : ""}${maskPhone(`91${phone}`)}. Prefers a call ${when.toLowerCase()}, in ${language}.` };
  store.saveSession(s);
  store.audit("owner", "callback:requested", s.id, when);
  return Response.json({ ok: true, when, masked: maskPhone(`91${phone}`) });
}
