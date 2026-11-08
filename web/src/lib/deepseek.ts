import type { ChatEndpoint } from "./groq";

/**
 * DeepSeek: the main model for the advisor and for reading KYC documents.
 * OpenAI-compatible, so it runs on the shared client in groq.ts.
 * deepseek-flash handles both tool calls and image input. DEEPSEEK_BASE_URL
 * points it at a reseller instead, e.g. Token Harbor (https://tokenharbor.ai/v1,
 * model deepseek-v4.1-flash:free).
 */

export const DEEPSEEK: ChatEndpoint = { name: "DeepSeek", base: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1", keyVar: "DEEPSEEK_API_KEY" };
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-flash";
export const DEEPSEEK_VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL ?? "deepseek-flash";
