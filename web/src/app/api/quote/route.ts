import { z } from "zod";
import { buildQuote, type Term } from "@/lib/pricing";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.string(),
  toggles: z.record(z.string(), z.boolean()).default({}),
  quantities: z.record(z.string(), z.number().int().min(1).max(500)).default({}),
  term: z.union([z.literal(12), z.literal(24), z.literal(36)]).optional(),
});

/** Re-prices the session's bundle as the owner toggles add-ons, quantities and term. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  const s = store.getSession(body.data.sessionId);
  if (!s?.recommendation) return Response.json({ error: "No bundle yet" }, { status: 404 });
  const quote = buildQuote({
    lines: s.recommendation.lines,
    toggles: body.data.toggles,
    quantities: body.data.quantities,
    term: body.data.term as Term | undefined,
    currentMonthlySpend: s.profile.monthlySpend,
  });
  s.quote = quote;
  store.saveSession(s);
  return Response.json({ quote, recommendation: s.recommendation, profile: s.profile });
}
