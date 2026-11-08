import { describe, expect, it } from "vitest";
import { rulesSummary } from "./chat-summary";
import type { AdvisorSession } from "./store";

describe("chat summary without AI", () => {
  it("says who the business is, what it wants, what we offered and what to do next", () => {
    const s = {
      id: "ses_t", status: "quoted", transcript: [{ role: "user", text: "hi", at: "" }, { role: "assistant", text: "hello", at: "" }, { role: "user", text: "ok", at: "" }],
      profile: { businessType: "Kirana store", city: "Kanpur", employees: 2, needs: ["internet", "pos_billing"] },
      requestedProducts: [], declinedProducts: ["P23"],
      quote: { monthlyWithGst: 2476, lines: [{ name: "Biz Fibre 100", active: true }, { name: "Cloud POS & Billing", active: true }] },
    } as unknown as AdvisorSession;
    const r = rulesSummary(s);
    expect(r.headline).toBe("Kirana store, in Kanpur, 2 people. Got a plan but didn't order.");
    expect(r.offered).toBe("Biz Fibre 100, Cloud POS & Billing at ₹2,476/month incl. GST");
    expect(r.concerns).toEqual(["Said no to Cloud CCTV"]);
    expect(r.nextStep).toMatch(/^Call/);
  });
});
