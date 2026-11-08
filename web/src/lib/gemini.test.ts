import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { advisorTurn } from "./advisor";
import type { AdvisorEvent } from "./advisor-types";
import { aiProvider } from "./ai";
import type { GeminiPart } from "./gemini";

beforeAll(() => {
  delete process.env.AI_DISABLED;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GROQ_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

/** One streamed model turn, split across SSE events the way the API sends it. */
function sse(...parts: GeminiPart[]) {
  const body = parts.map((p, i) => `data: ${JSON.stringify({ candidates: [{ content: { role: "model", parts: [p] }, ...(i === parts.length - 1 && { finishReason: "STOP" }) }] })}\r\n\r\n`).join("");
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

describe("Gemini advisor", () => {
  it("runs a function-calling round trip and the rules engine prices the bundle", async () => {
    const turns = [
      sse({ functionCall: { id: "c1", name: "update_profile", args: { businessType: "Kirana store", city: "Jaipur", employees: 2, sites: 1, hasGstin: false, currentInternet: "Mobile hotspot", needs: ["pos_billing", "cctv"] } }, thoughtSignature: "sig-1" }),
      sse({ functionCall: { id: "c2", name: "recommend_bundle", args: {} } }),
      sse({ text: "Here is your plan: " }, { text: "**Biz Fibre 100** and billing." }),
    ];
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return turns.shift()!;
    }));

    const events: AdvisorEvent[] = [];
    const s = await advisorTurn({ message: "kirana in jaipur, 2 log, billing aur CCTV chahiye", channel: "web", language: "en" }, (e) => events.push(e));

    expect(events.find((e) => e.type === "session")).toMatchObject({ mode: "ai" });
    const bundle = events.find((e) => e.type === "bundle");
    expect(bundle?.type === "bundle" && bundle.recommendation.lines.map((l) => l.productId)).toEqual(expect.arrayContaining(["P01", "P19", "P23"]));
    expect(s.transcript.at(-1)?.text).toBe("Here is your plan: **Biz Fibre 100** and billing.");

    // Thought signatures and tool results go back to the model.
    const last = bodies.at(-1) as { contents: { role: string; parts: GeminiPart[] }[] };
    expect(last.contents[1].parts[0].thoughtSignature).toBe("sig-1");
    const reply = last.contents.at(-1)!.parts[0].functionResponse!;
    expect(reply.name).toBe("recommend_bundle");
    expect(JSON.stringify(reply.response)).toContain("P19");
  });

  it("falls back to guided mode and pauses Gemini when billing fails", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: { code: 402, message: "Your prepayment credits are depleted." } }, { status: 402 }));
    vi.stubGlobal("fetch", fetchMock);

    const events: AdvisorEvent[] = [];
    await advisorTurn({ message: "", channel: "web", language: "en" }, (e) => events.push(e));
    expect(events.some((e) => e.type === "chips")).toBe(true);
    expect(aiProvider()).toBeUndefined();

    // The next conversation skips Gemini entirely instead of failing again.
    await advisorTurn({ message: "", channel: "web", language: "en" }, () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
