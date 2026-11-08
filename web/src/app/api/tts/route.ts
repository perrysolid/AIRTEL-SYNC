import { z } from "zod";
import { SARVAM_SPEAKER, SARVAM_TTS_MODEL } from "@/lib/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().min(1).max(1500), lang: z.string().default("hi-IN") });

/**
 * Optional natural Indic voice via Sarvam AI (Bulbul v3). Without SARVAM_API_KEY
 * this returns 204 and the browser falls back to the Web Speech API voices.
 */
export async function POST(req: Request) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return new Response(null, { status: 204 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  try {
    const r = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.data.text, target_language_code: body.data.lang, model: SARVAM_TTS_MODEL, speaker: SARVAM_SPEAKER }),
    });
    if (!r.ok) return new Response(null, { status: 204 });
    const json = (await r.json()) as { audios?: string[] };
    const audio = json.audios?.[0];
    if (!audio) return new Response(null, { status: 204 });
    return new Response(Buffer.from(audio, "base64"), { headers: { "Content-Type": "audio/wav" } });
  } catch {
    return new Response(null, { status: 204 });
  }
}
