/**
 * Minimal Groq client (OpenAI-compatible REST, no SDK): streaming chat with
 * tool calls for the advisor, vision for KYC documents, Whisper for voice notes.
 * DeepSeek speaks the same chat format, so it reuses this client with its own endpoint.
 */

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
export const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";
export const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL ?? "whisper-large-v3";

/** An OpenAI-compatible chat API: where to send requests and which key to use. */
export interface ChatEndpoint {
  name: string;
  base: string;
  keyVar: string;
}

export const GROQ: ChatEndpoint = { name: "Groq", base: "https://api.groq.com/openai/v1", keyVar: "GROQ_API_KEY" };

export interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type GroqContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type GroqMessage =
  | { role: "system" | "user"; content: string | GroqContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface GroqTool {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}

export interface GroqChatRequest {
  model: string;
  messages: GroqMessage[];
  tools?: GroqTool[];
  temperature?: number;
  max_completion_tokens?: number;
  response_format?: { type: "json_object" };
  reasoning_effort?: "low" | "medium" | "high";
}

export class GroqError extends Error {
  constructor(
    public status: number,
    message: string,
    provider = "Groq",
  ) {
    super(`${provider} ${status}: ${message}`);
  }
  /** Auth, billing or rate-limit problems: retrying soon won't help. */
  get persistent() {
    return [401, 402, 403, 429].includes(this.status);
  }
}

async function call(path: string, init: { json?: unknown; form?: FormData }, ep = GROQ, signal?: AbortSignal) {
  const key = process.env[ep.keyVar];
  if (!key) throw new GroqError(401, `${ep.keyVar} not set`, ep.name);
  const r = await fetch(`${ep.base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, ...(init.json ? { "Content-Type": "application/json" } : {}) },
    body: init.form ?? JSON.stringify(init.json),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
  });
  if (!r.ok) {
    let message = r.statusText;
    try {
      message = (await r.json()).error?.message ?? message;
    } catch {}
    throw new GroqError(r.status, message, ep.name);
  }
  return r;
}

export async function chat(req: GroqChatRequest, ep = GROQ): Promise<{ content: string | null; tool_calls?: GroqToolCall[] }> {
  const j = await (await call("/chat/completions", { json: req }, ep)).json();
  return j.choices?.[0]?.message ?? { content: null };
}

export interface GroqStreamResult {
  content: string;
  toolCalls: GroqToolCall[];
  finishReason?: string;
}

/** Streams text deltas to onText and assembles tool calls from their fragments. */
export async function streamChat(req: GroqChatRequest, onText: (delta: string) => void, ep = GROQ, signal?: AbortSignal): Promise<GroqStreamResult> {
  const r = await call("/chat/completions", { json: { ...req, stream: true } }, ep, signal);
  const reader = r.body!.getReader();
  const decoder = new TextDecoder();
  const out: GroqStreamResult = { content: "", toolCalls: [] };
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = event.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data || data === "[DONE]") continue;
      const chunk = JSON.parse(data);
      if (chunk.error) throw new GroqError(500, chunk.error.message ?? "stream error", ep.name);
      const c = chunk.choices?.[0];
      if (!c) continue;
      if (c.delta?.content) {
        out.content += c.delta.content;
        onText(c.delta.content);
      }
      for (const tc of c.delta?.tool_calls ?? []) {
        const slot = (out.toolCalls[tc.index ?? 0] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.function.name += tc.function.name;
        if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
      }
      out.finishReason = c.finish_reason ?? out.finishReason;
    }
    if (done) break;
  }
  out.toolCalls = out.toolCalls.filter(Boolean);
  return out;
}

/** Whisper transcription, any Indian language. */
export async function transcribeAudio(data: Buffer, mimeType: string): Promise<string | undefined> {
  const form = new FormData();
  const ext = mimeType.includes("mpeg") ? "mp3" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : mimeType.includes("wav") ? "wav" : mimeType.includes("webm") ? "webm" : "ogg";
  form.append("file", new Blob([new Uint8Array(data)], { type: mimeType.split(";")[0] }), `voice.${ext}`);
  form.append("model", GROQ_STT_MODEL);
  form.append("temperature", "0");
  const j = await (await call("/audio/transcriptions", { form })).json();
  return (j.text as string | undefined)?.trim() || undefined;
}
