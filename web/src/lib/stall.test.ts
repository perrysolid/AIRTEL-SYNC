import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { advisorTurn, STALL_MS } from "./advisor";
import type { AdvisorEvent } from "./advisor-types";

beforeAll(() => {
  delete process.env.AI_DISABLED;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.GROQ_API_KEY = "test-key";
  STALL_MS.first = 150;
});
afterEach(() => vi.unstubAllGlobals());

const reply = (text: string) =>
  new Response(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });

describe("a model that never answers", () => {
  it("hands the turn to the next model instead of leaving the owner waiting", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) =>
      String(url).includes("deepseek")
        ? new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))
        : Promise.resolve(reply("Namaste! What business do you run?")),
    ));
    const events: AdvisorEvent[] = [];
    const started = Date.now();
    const s = await advisorTurn({ message: "", channel: "web", language: "en" }, (e) => events.push(e));
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(s.transcript.at(-1)?.text).toBe("Namaste! What business do you run?");
    expect(events.filter((e) => e.type === "text").map((e) => e.type === "text" && e.delta).join("")).toBe("Namaste! What business do you run?");
  });
});
