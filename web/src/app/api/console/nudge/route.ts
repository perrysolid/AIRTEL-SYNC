import { z } from "zod";
import { deliver } from "@/lib/notify";
import { inr } from "@/lib/format";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ sessionId: z.string() });

/**
 * Lead rescue: nudge an owner who built a plan but didn't order, in the chat they came from, with the exact next step.
 * Only works for chat-born leads (we hold no phone number for anyone else).
 */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "sessionId required" }, { status: 400 });
  const s = store.getSession(body.data.sessionId);
  if (!s) return Response.json({ error: "Lead not found" }, { status: 404 });
  if (s.status === "ordered") return Response.json({ error: "This lead already ordered." }, { status: 409 });
  if (!s.botChat || !s.quote) return Response.json({ error: "This lead has no chat to nudge, or no quote yet. Call them from the list instead." }, { status: 409 });
  const name = s.profile.businessName ?? s.profile.businessType ?? "your business";
  const text = `Hi 👋 your plan for ${name} is saved: ${inr(s.quote.monthlyWithGst)}/month incl. GST for ${s.quote.lines.filter((l) => l.active).length} services.\nYou're one step away: verification takes about 2 minutes, right on our secure page. Reply ORDER to continue, or NEW to start over.`;
  await deliver(s.botChat, { text });
  store.audit("partner", "lead:nudge", s.id, s.botChat.channel);
  return Response.json({ ok: true, sent: text });
}
