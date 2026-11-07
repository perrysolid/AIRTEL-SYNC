import Anthropic from "@anthropic-ai/sdk";

/**
 * Single place that decides which GenAI provider is used. Gemini is primary,
 * Claude secondary; every AI feature also has a deterministic fallback, so
 * the journey works (and demos) without any key.
 */

export type AiProvider = "gemini" | "anthropic";

export const ADVISOR_MODEL = process.env.ADVISOR_MODEL ?? "claude-opus-5-5";
export const EXTRACT_MODEL = process.env.EXTRACT_MODEL ?? "claude-opus-5-5";

let client: Anthropic | undefined;

const g = globalThis as unknown as { __aiDownUntil?: Map<AiProvider, number> };
const downUntil = (g.__aiDownUntil ??= new Map());

function configured(p: AiProvider): boolean {
  if (p === "gemini") return !!process.env.GEMINI_API_KEY;
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Providers that are configured and not paused, in preference order. */
export function aiProviders(): AiProvider[] {
  if (process.env.AI_DISABLED === "1") return [];
  const order: AiProvider[] = process.env.AI_PROVIDER === "anthropic" ? ["anthropic", "gemini"] : ["gemini", "anthropic"];
  return order.filter((p) => configured(p) && (downUntil.get(p) ?? 0) < Date.now());
}

export function aiProvider(): AiProvider | undefined {
  return aiProviders()[0];
}

export function aiEnabled(): boolean {
  return aiProvider() !== undefined;
}

/** After a billing/auth/quota failure, skip the provider for a while instead of failing every turn. */
export function pauseProvider(p: AiProvider, ms = 10 * 60_000) {
  downUntil.set(p, Date.now() + ms);
  console.warn(`[ai] ${p} paused for ${Math.round(ms / 60_000)} min`);
}

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
