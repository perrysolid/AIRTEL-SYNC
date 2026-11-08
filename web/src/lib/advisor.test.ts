import { beforeAll, describe, expect, it } from "vitest";
import { advisorTurn } from "./advisor";
import type { AdvisorEvent } from "./advisor-types";

beforeAll(() => {
  process.env.AI_DISABLED = "1";
});

async function talk(lines: string[], language = "en") {
  let sessionId: string | undefined;
  const events: AdvisorEvent[] = [];
  for (const message of lines) {
    const s = await advisorTurn({ sessionId, message, channel: "web", language }, (e) => events.push(e));
    sessionId = s.id;
  }
  return { events, text: events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("\n") };
}

describe("guided advisor (no LLM)", () => {
  it("reaches a bundle from one rich sentence plus needs", async () => {
    const { events } = await talk(["", "I run a dental clinic in Pune with 8 staff, we have GST", "cur:Home broadband", "needs:email,backup_internet"]);
    const bundle = events.find((e) => e.type === "bundle");
    expect(bundle).toBeTruthy();
    if (bundle?.type === "bundle") {
      expect(bundle.quote.monthly).toBeGreaterThan(0);
      expect(bundle.recommendation.lines.map((l) => l.productId)).toContain("P02");
    }
  });

  it("GSTIN shortcut pre-fills the profile and skips questions", async () => {
    const { events, text } = await talk(["", "32TTNXB7384T1ZW"]);
    expect(text).toMatch(/Balaji Dental Care/);
    const profile = events.filter((e) => e.type === "profile").at(-1);
    expect(profile?.type === "profile" && profile.profile.employees).toBe(20);
  });

  it("speaks Hindi and handles chip answers", async () => {
    const { events, text } = await talk(["", "type:Kirana store", "city:Jaipur", "emp:2", "gst:no", "cur:Mobile hotspot", "needs:pos_billing,whatsapp"], "hi");
    expect(text).toMatch(/नमस्ते/);
    const bundle = events.find((e) => e.type === "bundle");
    expect(bundle?.type === "bundle" && bundle.recommendation.excluded.map((e) => e.productId)).toContain("P15");
  });

  it("hands off to a partner when asked", async () => {
    const { events } = await talk(["", "can someone call me please, I want to talk to a human"]);
    expect(events.some((e) => e.type === "handoff")).toBe(true);
  });

  it("serves tier-2 cities beyond the case data, including old names", async () => {
    const { tierForCity } = await import("./profile");
    expect([tierForCity("Kanpur"), tierForCity("bangalore"), tierForCity("Vizag"), tierForCity("Manali")]).toEqual([2, 1, 2, undefined]);
  });

  it("explains when a city is not served", async () => {
    const { text } = await talk(["", "I have a salon in Manali"]);
    expect(text).toMatch(/don't offer business connections in Manali/);
  });
});

describe("discovery before the first plan", () => {
  it("lists what the advisor still has to learn", async () => {
    const { stillToLearn } = await import("./advisor");
    expect(stillToLearn({ businessType: "Kirana store", city: "Kanpur", employees: 2, needs: ["internet", "pos_billing"] })).toEqual([
      "how many shops or branches",
      "whether it has GST",
      "what they use for internet today (and roughly what they pay)",
    ]);
    expect(stillToLearn({ businessType: "Kirana store", city: "Kanpur", employees: 2, sites: 1, hasGstin: false, currentInternet: "Mobile hotspot", needs: ["internet"] })).toEqual([]);
  });
});
