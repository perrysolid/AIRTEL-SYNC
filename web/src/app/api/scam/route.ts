import { z } from "zod";
import { analyzeScam } from "@/lib/scam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().min(1, "Paste a message to check").max(5000), lang: z.enum(["en", "hi"]).default("en") });

/** Scam Shield: explainable triage of a pasted message or link. The text is analysed in memory and never stored. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  return Response.json(analyzeScam(body.data.text, body.data.lang));
}
