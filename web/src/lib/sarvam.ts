import { GroqError, type ChatEndpoint } from "./groq";

/**
 * Sarvam AI: Indian-language models hosted in India. Sarvam 105B runs the
 * advisor chat (fast, natural Hindi and Hinglish) through the shared
 * OpenAI-style client; it has no vision, so documents go to DeepSeek. Saaras
 * transcribes voice notes and Bulbul speaks replies (see /api/tts).
 */

export const SARVAM: ChatEndpoint = { name: "Sarvam", base: "https://api.sarvam.ai/v1", keyVar: "SARVAM_API_KEY" };
export const SARVAM_MODEL = process.env.SARVAM_MODEL ?? "sarvam-105b";

export const SARVAM_STT_MODEL = process.env.SARVAM_STT_MODEL ?? "saaras:v4";
export const SARVAM_TTS_MODEL = process.env.SARVAM_TTS_MODEL ?? "bulbul:v3";
export const SARVAM_SPEAKER = process.env.SARVAM_SPEAKER ?? "priya";

/** Speech to text in any of 22 Indian languages; WhatsApp/Telegram send OGG/Opus. */
export async function transcribeAudio(data: Buffer, mimeType: string): Promise<string | undefined> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new GroqError(401, "SARVAM_API_KEY not set", "Sarvam");
  const type = mimeType.split(";")[0];
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type }), `voice.${type.split("/")[1] ?? "ogg"}`);
  form.append("model", SARVAM_STT_MODEL);
  const r = await fetch("https://api.sarvam.ai/speech-to-text", { method: "POST", headers: { "api-subscription-key": key }, body: form, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new GroqError(r.status, (await r.text()).slice(0, 200), "Sarvam");
  return ((await r.json()).transcript as string | undefined)?.trim() || undefined;
}
