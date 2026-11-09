import { describe, expect, it } from "vitest";
import { rulesSummary } from "./chat-summary";
import type { AdvisorSession, Order } from "./store";

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

describe("chat summary after an order", () => {
  it("takes what was bought and what to do next from the order, not from the cached summary", async () => {
    const { chatSummary } = await import("./chat-summary");
    const { store } = await import("./store");
    const { buildTimeline, liveDay } = await import("./tracker");
    const timeline = buildTimeline(["P02"]);
    const order = {
      id: "ACC-SUMTEST01", notifications: [], timeline, lines: [{ name: "Biz Fibre 300", qty: 1 }, { name: "Business Postpaid 299", qty: 2 }],
      quote: { monthlyWithGst: 4589 }, kyc: { result: { verdict: "verified" } }, esign: { at: "" },
    } as unknown as Order;
    store.saveOrder(order);
    const stale = { headline: "h", needs: [], offered: "Biz 5G AirFiber 100 at ₹3,804/month", concerns: [], outcome: "ordered", nextStep: "Call the owner to book the installation slot.", by: "ai" as const, turns: 2, at: "" };
    const s = { id: "ses_sum", status: "ordered", orderId: order.id, transcript: [{}, {}], summary: stale, profile: { needs: [] }, declinedProducts: [] } as unknown as AdvisorSession;

    let r = await chatSummary(s);
    expect(r.offered).toBe("Biz Fibre 300, Business Postpaid 299 × 2 at ₹4,589/month incl. GST");
    expect(r.nextStep).toMatch(/^Nothing: installation is on track/);

    order.timeline.clockDay = liveDay(order.timeline);
    order.payment = { at: "", method: "upi_autopay", amount: 1, ref: "x" };
    r = await chatSummary(s);
    expect(r.nextStep).toMatch(/live and paid/);

    order.rating = { score: 2, at: "" };
    expect((await chatSummary(s)).nextStep).toMatch(/rated the installation 2\/5/);
  });
});
