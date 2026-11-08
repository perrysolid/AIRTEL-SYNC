import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { advisorTurn } from "./advisor";
import type { AdvisorEvent } from "./advisor-types";
import { aiProviders } from "./ai";
import { validateKyc } from "./kyc";
import { APPLICANTS } from "./__fixtures__/kyc-applicants";

beforeAll(() => {
  delete process.env.AI_DISABLED;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

/** OpenAI-style SSE: a tool call's arguments arrive in fragments across chunks. */
function sse(chunks: Record<string, unknown>[]) {
  const body = chunks.map((delta, i) => `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: i === chunks.length - 1 ? "stop" : null }] })}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}
const call = (id: string, name: string, args: string) => [
  { tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: "" } }] },
  { tool_calls: [{ index: 0, function: { arguments: args.slice(0, 10) } }] },
  { tool_calls: [{ index: 0, function: { arguments: args.slice(10) } }] },
];

describe("Groq advisor", () => {
  it("assembles streamed tool calls, runs the rules engine and returns results to the model", async () => {
    const turns = [
      sse(call("t1", "update_profile", JSON.stringify({ businessType: "Kirana store", city: "Jaipur", employees: 2, sites: 1, hasGstin: false, currentInternet: "Mobile hotspot", needs: ["pos_billing", "cctv"] }))),
      sse(call("t2", "recommend_bundle", "{}")),
      sse([{ content: "Here is your plan: " }, { content: "**Biz Fibre 100** and billing." }]),
    ];
    const bodies: { messages: { role: string; tool_call_id?: string; content: string | null }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return turns.shift()!;
    }));

    const events: AdvisorEvent[] = [];
    const s = await advisorTurn({ message: "kirana in jaipur, 2 log, billing aur CCTV chahiye", channel: "web", language: "en" }, (e) => events.push(e));

    const bundle = events.find((e) => e.type === "bundle");
    expect(bundle?.type === "bundle" && bundle.recommendation.lines.map((l) => l.productId)).toEqual(expect.arrayContaining(["P01", "P19", "P23"]));
    expect(s.transcript.at(-1)?.text).toBe("Here is your plan: **Biz Fibre 100** and billing.");
    const toolReply = bodies.at(-1)!.messages.findLast((m) => m.role === "tool")!;
    expect(toolReply.tool_call_id).toBe("t2");
    expect(toolReply.content).toContain("P19");
  });

  it("a rate limit (429) falls back to guided mode and pauses Groq only briefly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Rate limit reached" } }, { status: 429 })));
    const events: AdvisorEvent[] = [];
    await advisorTurn({ message: "", channel: "web", language: "en" }, (e) => events.push(e));
    expect(events.some((e) => e.type === "chips")).toBe(true);
    expect(aiProviders()).not.toContain("groq");
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    expect(aiProviders()).toContain("groq");
    vi.useRealTimers();
  });
});

describe("blurred document safeguard", () => {
  it("a guessed GSTIN from a blurred photo asks for a retake instead of rejecting", () => {
    const docs = { ...APPLICANTS.K04, gst_certificate: { ...APPLICANTS.K06.gst_certificate!, qualityIssues: ["blurred"], confidence: 0.85, fields: { ...APPLICANTS.K06.gst_certificate!.fields, gstin: "27PZSKS193601ZM" } } };
    const r = validateKyc(docs);
    expect(r.checks.map((c) => c.id)).toContain("gst_certificate_illegible");
    expect(r.verdict).toBe("needs_attention");
  });
  it("the same bad checksum on a clear photo is still rejected", () => {
    expect(validateKyc(APPLICANTS.K06).verdict).toBe("rejected");
  });
});
