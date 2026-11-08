import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { advisorTurn } from "./advisor";
import type { AdvisorEvent } from "./advisor-types";
import { aiProviders } from "./ai";
import { transcribeVoice } from "./bots/core";
import { extractDocument } from "./extract";

beforeAll(() => {
  delete process.env.AI_DISABLED;
  delete process.env.AI_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = "test-groq";
  process.env.DEEPSEEK_API_KEY = "test-deepseek";
  process.env.SARVAM_API_KEY = "test-sarvam";
});
afterEach(() => vi.unstubAllGlobals());

const sse = (text: string) => new Response(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });

describe("provider chain", () => {
  it("Claude Haiku leads the chain; Sarvam is voice-only, not a chat provider", () => {
    process.env.ANTHROPIC_API_KEY = "test-claude";
    expect(aiProviders()).toEqual(["anthropic", "deepseek", "groq"]);
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("without a Claude key, DeepSeek runs the advisor chat", async () => {
    expect(aiProviders()).toEqual(["deepseek", "groq"]);
    const calls: { url: string; body: { model: string } }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return sse("नमस्ते! आपकी दुकान कहाँ है?");
    }));
    const events: AdvisorEvent[] = [];
    await advisorTurn({ message: "", channel: "web", language: "hi" }, (e) => events.push(e));
    expect(calls[0].url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(calls[0].body.model).toBe("deepseek-flash");
    expect(events.filter((e) => e.type === "text").map((e) => e.type === "text" && e.delta).join("")).toContain("नमस्ते");
  });

  it("a busy provider hands the same turn to the next one instead of offline mode", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      if (url.includes("deepseek")) return Response.json({ error: { message: "busy" } }, { status: 503 });
      const body = JSON.parse(init.body as string) as { messages: { role: string }[] };
      expect(body.messages.filter((m) => m.role === "user")).toHaveLength(1);
      return sse("Hello from Groq");
    }));
    const events: AdvisorEvent[] = [];
    const s = await advisorTurn({ message: "", channel: "web", language: "en" }, (e) => events.push(e));
    expect(urls.map((u) => new URL(u).host)).toEqual(["api.deepseek.com", "api.groq.com"]);
    expect(events.some((e) => e.type === "chips")).toBe(false);
    expect(s.transcript.at(-1)?.text).toBe("Hello from Groq");
    expect(s.guidedStep).toBeUndefined();
  });

  it("DeepSeek reads KYC documents from the image", async () => {
    const doc = { docType: "gst_certificate", legible: true, qualityIssues: [], confidence: 0.95, fields: { gstin: "27AAPFU0939F1ZV", legalName: "Woodcraft Furniture" } };
    const bodies: { model: string; messages: { content: { type: string }[] }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain("api.deepseek.com");
      bodies.push(JSON.parse(init.body as string));
      return Response.json({ choices: [{ message: { content: JSON.stringify(doc) } }] });
    }));
    const r = await extractDocument(Buffer.from("png"), "image/png");
    expect(r.engine).toBe("deepseek-vision");
    expect(r.doc.fields.gstin).toBe("27AAPFU0939F1ZV");
    expect(bodies[0].messages[0].content.map((p) => p.type)).toContain("image_url");
  });

  it("Sarvam transcribes voice notes, with Groq Whisper as the fallback", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      return url.includes("sarvam") ? new Response("busy", { status: 503 }) : Response.json({ text: "CCTV chahiye" });
    }));
    expect(await transcribeVoice(Buffer.from("ogg"), "audio/ogg; codecs=opus")).toBe("CCTV chahiye");
    expect(urls[0]).toBe("https://api.sarvam.ai/speech-to-text");
  });
});
