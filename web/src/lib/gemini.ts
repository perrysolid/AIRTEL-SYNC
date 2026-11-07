/**
 * Minimal Gemini API client (REST, no SDK): non-streaming and SSE streaming
 * generateContent. Used for the advisor (function calling) and KYC vision.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
export const GEMINI_EXTRACT_MODEL = process.env.GEMINI_EXTRACT_MODEL ?? GEMINI_MODEL;

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiPart {
  text?: string;
  thought?: boolean;
  /** Must be sent back unchanged with the part it came on (Gemini 3 thinking). */
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  tools?: { functionDeclarations: { name: string; description: string; parametersJsonSchema?: unknown }[] }[];
  generationConfig?: Record<string, unknown>;
}

export interface GeminiResponse {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(`Gemini ${status}: ${message}`);
  }
  /** Billing, auth or quota problems: retrying soon won't help. */
  get persistent() {
    return [401, 402, 403, 429].includes(this.status);
  }
}

/** Low thinking keeps voice replies snappy; Gemini 2.5 uses a token budget instead. */
export function thinking(model: string) {
  return model.startsWith("gemini-2") ? { thinkingBudget: 512 } : { thinkingLevel: "low" };
}

async function call(model: string, method: string, body: GeminiRequest, signal?: AbortSignal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError(401, "GEMINI_API_KEY not set");
  const r = await fetch(`${BASE}/${model}:${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(60_000),
  });
  if (!r.ok) {
    let message = r.statusText;
    try {
      message = (await r.json()).error?.message ?? message;
    } catch {}
    throw new GeminiError(r.status, message);
  }
  return r;
}

export async function generate(model: string, body: GeminiRequest): Promise<GeminiResponse> {
  return (await call(model, "generateContent", body)).json();
}

export async function* streamGenerate(model: string, body: GeminiRequest): AsyncGenerator<GeminiResponse> {
  const r = await call(model, "streamGenerateContent?alt=sse", body);
  const reader = r.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = event.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (data) yield JSON.parse(data) as GeminiResponse;
    }
    if (done) break;
  }
}
