import Anthropic from "@anthropic-ai/sdk";

/**
 * Single place that decides which GenAI provider is used. DeepSeek is primary
 * (chat and documents), then Gemini, Groq and Claude; every AI
 * feature also has a deterministic fallback, so the journey works (and demos) without any key.
 */

export type AiProvider = "deepseek" | "groq" | "gemini" | "anthropic";

export const ADVISOR_MODEL = process.env.ADVISOR_MODEL ?? "claude-opus-5-5";
export const EXTRACT_MODEL = process.env.EXTRACT_MODEL ?? "claude-opus-5-5";

let client: Anthropic | undefined;

const g = globalThis as unknown as { __aiDownUntil?: Map<AiProvider, number> };
const downUntil = (g.__aiDownUntil ??= new Map());

function configured(p: AiProvider): boolean {
  if (p === "deepseek") return !!process.env.DEEPSEEK_API_KEY;
  if (p === "groq") return !!process.env.GROQ_API_KEY;
  if (p === "gemini") return !!process.env.GEMINI_API_KEY;
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Providers that are configured and not paused, in preference order. */
export function aiProviders(): AiProvider[] {
  if (process.env.AI_DISABLED === "1") return [];
  // AI_PROVIDER moves one provider to the front; the rest keep their order.
  const preferred = process.env.AI_PROVIDER as AiProvider | undefined;
  const order: AiProvider[] = ["deepseek", "gemini", "groq", "anthropic"].sort((a, b) => +(b === preferred) - +(a === preferred)) as AiProvider[];
  return order.filter((p) => configured(p) && (downUntil.get(p) ?? 0) < Date.now());
}

export function aiProvider(): AiProvider | undefined {
  return aiProviders()[0];
}

export function aiEnabled(): boolean {
  return aiProvider() !== undefined;
}

/**
 * After a billing/auth/quota failure, skip the provider for a while instead of
 * failing every turn. A 429 is a per-minute rate limit, so it only pauses briefly.
 */
export function pauseProvider(p: AiProvider, status?: number) {
  const ms = status === 429 ? 60_000 : 10 * 60_000;
  downUntil.set(p, Date.now() + ms);
  console.warn(`[ai] ${p} paused for ${ms / 1000}s (${status ?? "error"})`);
}

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
