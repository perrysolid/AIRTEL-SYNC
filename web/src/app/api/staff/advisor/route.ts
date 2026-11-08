import { summarize } from "@/lib/advisor";
import { staffOr401 } from "@/lib/staff-api";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readable = (t?: string) => (t && !/^[a-z]+:/.test(t) ? t : undefined);

/** Conversations the advisor could not close: asked for a person, got a quote but didn't order, or went quiet. */
export async function GET() {
  const a = await staffOr401(["admin", "sales"]);
  if ("res" in a) return a.res;
  const quiet = (iso: string) => Date.now() - new Date(iso).getTime() > 2 * 60_000;
  const chats = store
    .listSessions()
    .filter((s) => s.status === "handoff" || (s.status === "quoted" && quiet(s.updatedAt)) || (s.status === "open" && s.transcript.length > 2 && quiet(s.updatedAt)))
    .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
    .slice(0, 50)
    .map((s) => ({
      id: s.id,
      status: s.status,
      channel: s.channel,
      language: s.language,
      updatedAt: s.updatedAt,
      business: [s.profile.businessName, s.profile.businessType].filter(Boolean).join(", ") || "Unnamed business",
      city: s.profile.city ?? null,
      summary: s.handoff?.summary || summarize(s),
      reason: s.handoff?.reason ?? (s.status === "quoted" ? "Got a plan but didn't order" : "Went quiet mid-conversation"),
      lastMessage: readable([...s.transcript].reverse().find((t) => t.role === "user" && t.text)?.text)?.slice(0, 160) ?? null,
      monthlyWithGst: s.quote?.monthlyWithGst ?? null,
      canNudge: !!s.botChat && !!s.quote && s.status !== "handoff",
    }));
  return Response.json({ chats });
}
