import { z } from "zod";
import { aiProviders, anthropic, ADVISOR_MODEL } from "./ai";
import { product } from "./catalogue";
import { inr } from "./format";
import { NEED_LABELS } from "./profile";
import { redactText } from "./privacy";
import { now, store, type AdvisorSession, type ChatSummary } from "./store";

/**
 * What happened in an advisor conversation, for the people who pick it up: the salesperson calling back, the
 * partner visiting, the manager reviewing the day. Written by Claude from the transcript when it is available,
 * otherwise from the facts the advisor recorded. Cached on the session and rewritten only when the chat moves on.
 */

const Reply = z.object({
  headline: z.string().min(5).max(300),
  needs: z.array(z.string().max(80)).max(6),
  offered: z.string().max(200).nullable(),
  concerns: z.array(z.string().max(120)).max(4),
  outcome: z.string().max(160),
  nextStep: z.string().max(200),
});

const PROMPT = `You summarise a conversation between a small-business owner in India and "Udyam", Accel Business's sales advisor, for the Accel salesperson or manager who will follow up.
Write in plain English (translate if the chat was in another language). Be specific to this owner; no filler, no marketing words.
Reply with only a JSON object:
{"headline": "1-2 sentences: who the business is and how the conversation ended",
 "needs": ["what they actually want, in their terms, max 6"],
 "offered": "the plan and monthly price we showed, or null if none",
 "concerns": ["doubts or objections they raised (price, timing, trust...), max 4, empty if none"],
 "outcome": "ordered / asked for a person / got a plan but didn't order / dropped mid-chat, with the reason if they gave one",
 "nextStep": "the single most useful thing the salesperson should do next"}
Refer to the owner as "the owner" or "they"; never guess their gender. Never include phone numbers, GSTIN, Udyam, Aadhaar or PAN numbers.`;

function outcomeOf(s: AdvisorSession) {
  if (s.status === "ordered") return `Ordered${s.orderId ? ` (${s.orderId})` : ""}`;
  if (s.status === "handoff") return `Asked for a person: ${s.handoff?.reason ?? "no reason given"}`;
  if (s.quote) return "Got a plan but didn't order";
  return s.transcript.length > 2 ? "Went quiet mid-conversation" : "Only said hello";
}

/** Built from what the advisor recorded; used until (or instead of) the AI summary. */
export function rulesSummary(s: AdvisorSession): ChatSummary {
  const p = s.profile;
  const who = [p.businessName ?? p.businessType ?? "A business", p.city && `in ${p.city}`, p.employees && `${p.employees} people`, p.sites && p.sites > 1 && `${p.sites} sites`].filter(Boolean).join(", ");
  const offered = s.quote ? `${s.quote.lines.filter((l) => l.active && !l.blockedReason).map((l) => l.name).join(", ")} at ${inr(s.quote.monthlyWithGst)}/month incl. GST` : null;
  const outcome = outcomeOf(s);
  return {
    headline: `${who}. ${outcome}.`,
    needs: p.needs.map((n) => NEED_LABELS[n] ?? n),
    offered,
    concerns: [p.budget && `Budget up to ${inr(p.budget)}/month`, s.declinedProducts.length && `Said no to ${s.declinedProducts.map((id) => product(id)?.name ?? id).join(", ")}`].filter(Boolean) as string[],
    outcome,
    nextStep: s.status === "ordered" ? "Nothing: the order is moving and the owner gets updates on their own." : s.quote ? "Call to answer what held them back, or send a reminder in their chat." : "Call to finish the needs check and show a plan.",
    by: "rules",
    turns: s.transcript.length,
    at: now(),
  };
}

// Summaries are written one at a time, so they never take capacity from owners chatting with the advisor right now,
// and a failed one waits 10 minutes before it is tried again.
const inFlight = new Map<string, Promise<ChatSummary>>();
const lastTry = new Map<string, { turns: number; at: number }>();
let queue: Promise<unknown> = Promise.resolve();
const RETRY_MS = 10 * 60_000;

async function writeWithAi(s: AdvisorSession): Promise<ChatSummary | undefined> {
  if (!aiProviders().includes("anthropic") || s.transcript.length < 2) return undefined;
  const transcript = s.transcript
    .slice(-40)
    .map((t) => `${t.role === "user" ? "Owner" : "Advisor"}: ${redactText(t.text).slice(0, 600)}`)
    .join("\n");
  const facts = `Recorded facts: ${JSON.stringify({ ...s.profile, gstin: undefined, udyam: undefined })}\nOutcome so far: ${outcomeOf(s)}${s.quote ? `\nPlan shown: ${rulesSummary(s).offered}` : ""}`;
  const res = await anthropic().messages.create(
    { model: ADVISOR_MODEL, max_tokens: 700, output_config: { effort: "low" }, system: PROMPT, messages: [{ role: "user", content: `${facts}\n\nTranscript:\n${transcript}` }] },
    { timeout: 20_000, maxRetries: 0 },
  );
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = Reply.safeParse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1) || "{}"));
  if (!parsed.success) return undefined;
  return { ...parsed.data, by: "ai", turns: s.transcript.length, at: now() };
}

/** The summary to show now. A stale or missing AI summary is refreshed in the background (or awaited with `wait`). */
export async function chatSummary(s: AdvisorSession, opts: { wait?: boolean } = {}): Promise<ChatSummary> {
  const current = s.summary && s.summary.turns === s.transcript.length ? s.summary : undefined;
  const ai = aiProviders().includes("anthropic") && s.transcript.length >= 2;
  if (current && (current.by === "ai" || !ai)) return current;
  const tried = lastTry.get(s.id);
  const backingOff = tried && tried.turns === s.transcript.length && Date.now() - tried.at < RETRY_MS;
  let job = inFlight.get(s.id);
  if (!job && !backingOff) {
    const run = async () => {
      lastTry.set(s.id, { turns: s.transcript.length, at: Date.now() });
      const written = ai
        ? await writeWithAi(s).catch((err) => {
            console.warn(`[summary] ${s.id}: ${(err as Error).message.slice(0, 120)}`);
            return undefined;
          })
        : undefined;
      const fresh = store.getSession(s.id) ?? s;
      fresh.summary = written ?? rulesSummary(fresh);
      // A summary is not owner activity: keep "last active" as it was (reminders and the quiet filter read it).
      const lastActive = fresh.updatedAt;
      store.saveSession(fresh);
      fresh.updatedAt = lastActive;
      return fresh.summary;
    };
    job = queue.then(run, run).finally(() => inFlight.delete(s.id));
    queue = job.catch(() => undefined);
    inFlight.set(s.id, job);
  }
  return opts.wait && job ? job : (current ?? s.summary ?? rulesSummary(s));
}
