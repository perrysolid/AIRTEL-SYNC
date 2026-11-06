import Anthropic from "@anthropic-ai/sdk";

/**
 * Single place that decides whether GenAI is available. Every AI feature has
 * a deterministic fallback, so the journey works (and demos) without a key.
 */

export const ADVISOR_MODEL = process.env.ADVISOR_MODEL ?? "claude-opus-5-5";
export const EXTRACT_MODEL = process.env.EXTRACT_MODEL ?? "claude-opus-5-5";

let client: Anthropic | undefined;

export function aiEnabled(): boolean {
  return process.env.AI_DISABLED !== "1" && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
