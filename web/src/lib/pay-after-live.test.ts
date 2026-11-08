import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));

import { POST } from "@/app/api/order/[id]/action/route";
import { buildQuote } from "./pricing";
import { recommend } from "./recommend";
import { store, type Order } from "./store";
import { buildTimeline, liveDay } from "./tracker";

function signedReadyOrder(): Order {
  const profile = { businessType: "Kirana store", city: "Kanpur", cityTier: 2 as const, employees: 2, sites: 1, hasGstin: false, needs: ["internet" as const, "pos_billing" as const] };
  const rec = recommend({ profile });
  const quote = buildQuote({ lines: rec.lines });
  const lines = quote.lines.filter((l) => l.active && !l.blockedReason);
  const o: Order = {
    id: "ACC-PAYLATE1", createdAt: new Date().toISOString(), businessName: "Sharma Kirana", city: "Kanpur", channel: "web", phone: "9876543210",
    profile, lines, term: quote.term, quote, timeline: buildTimeline(lines.map((l) => l.productId), "ACC-PAYLATE1"), notifications: [],
    consentId: "c1", kyc: { result: { verdict: "verified" }, docs: [], at: new Date().toISOString(), registryLookups: {} } as unknown as Order["kyc"],
  } as Order;
  store.saveOrder(o);
  return o;
}

const act = (id: string, body: object) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

describe("pay after installation", () => {
  it("signing starts installation, the bill comes when everything is live, and only then can it be paid", async () => {
    const o = signedReadyOrder();
    expect((await act(o.id, { action: "esign", otp: "123456" })).status).toBe(200);
    expect(store.getOrder(o.id)!.timeline.clockDay).toBe(0);
    expect((await act(o.id, { action: "pay", method: "upi_autopay" })).status).toBe(409);

    for (let d = 0; d < liveDay(o.timeline); d++) await act(o.id, { action: "next_day" });
    const texts = store.getOrder(o.id)!.notifications.map((n) => n.text);
    expect(texts.some((t) => t.includes("is your installation technician"))).toBe(true);
    expect(texts.some((t) => t.startsWith("🧾 Your first bill"))).toBe(true);

    expect((await act(o.id, { action: "pay", method: "upi_autopay" })).status).toBe(200);
    expect(store.getOrder(o.id)!.payment).toBeDefined();
  });
});
