import { describe, expect, it } from "vitest";
import { newSession } from "./advisor";
import { orderCard, orderHeadline, quoteCard } from "./cards";
import { createOrder } from "./orders";
import { buildQuote } from "./pricing";
import { recommend } from "./recommend";
import { advance } from "./tracker";

const PNG = [0x89, 0x50, 0x4e, 0x47];

function sampleOrder() {
  const s = newSession("web", "en");
  s.profile = { ...s.profile, businessType: "Kirana store", segment: "multi", city: "Jaipur", cityTier: 1, employees: 12, sites: 3, hasGstin: true, needs: ["pos_billing", "cctv", "whatsapp", "mobile_lines"] } as typeof s.profile;
  s.quote = buildQuote({ lines: recommend({ profile: s.profile }).lines, term: 12 });
  return { s, o: createOrder(s, { contactName: "Test", phone: "9812345678" }) };
}

describe("chat cards", () => {
  it("render the plan and order status as PNGs", async () => {
    const { s, o } = sampleOrder();
    for (const res of [quoteCard(s), orderCard(o)]) {
      expect(res.headers.get("content-type")).toBe("image/png");
      expect([...new Uint8Array(await res.arrayBuffer()).slice(0, 4)]).toEqual(PNG);
    }
  }, 30_000);

  it("headline follows the journey", () => {
    const { o } = sampleOrder();
    expect(orderHeadline(o).title).toBe("Order placed");
    o.kyc = { result: { verdict: "verified", checks: [], summary: "", actions: [] }, docs: [], at: "", registryLookups: {} };
    expect(orderHeadline(o).title).toBe("Business verified");
    o.esign = { at: "", method: "aadhaar-otp-mock", docHash: "x" };
    o.payment = { at: "", method: "upi_autopay", amount: 1, ref: "x" };
    o.timeline.clockDay = 0;
    advance(o.timeline, 1);
    expect(orderHeadline(o).title).toBe("Day 1 of 5");
    advance(o.timeline, 30);
    expect(orderHeadline(o).title).toBe("Everything is live");
  });
});
