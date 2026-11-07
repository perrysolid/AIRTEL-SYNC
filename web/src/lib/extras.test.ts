import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the JSON store at a throw-away folder before any module reads STORE_DIR.
process.env.STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));

import { addFailover, checkSpeed, continuity, createTicket, endOutage, hasFailover, startOutage } from "./continuity";
import { createBranch, previewBranch } from "./branch";
import { adaptForAirFiber, checkNetwork } from "./network";
import { buildQuote } from "./pricing";
import type { Profile } from "./profile";
import { recommend } from "./recommend";
import { MAX_RESCHEDULES, scheduleInstall, slotsFor } from "./scheduler";
import type { Order } from "./store";
import { advance, buildTimeline, liveDay } from "./tracker";

function makeOrder(profile: Profile, over: Partial<Order> = {}): Order {
  const rec = recommend({ profile });
  const quote = buildQuote({ lines: rec.lines });
  const lines = quote.lines.filter((l) => l.active && !l.blockedReason);
  const order: Order = {
    id: "ACC-TEST01", createdAt: new Date("2026-07-15T10:00:00Z").toISOString(), businessName: "Test Co", city: profile.city, channel: "web",
    profile: { ...profile, segment: rec.segment }, lines, term: quote.term, quote, timeline: buildTimeline(lines.map((l) => l.productId)),
    notifications: [], consentId: "consent_1", kyc: { result: { verdict: "verified" }, docs: [], at: new Date().toISOString(), registryLookups: {} } as unknown as Order["kyc"],
    esign: { at: new Date().toISOString(), method: "aadhaar-otp-mock", docHash: "h" }, payment: { at: new Date("2026-07-15T10:00:00Z").toISOString(), method: "upi_autopay", amount: quote.monthlyWithGst, ref: "UPI1" },
    ...over,
  };
  order.timeline.clockDay = 0;
  return order;
}

const clinic: Profile = { businessType: "Dental clinic", city: "Kochi", cityTier: 2, employees: 15, sites: 1, hasGstin: true, gstinActive: true, needs: ["email"] };
const chain: Profile = { businessType: "Restaurant chain", city: "Delhi", cityTier: 1, employees: 60, sites: 8, hasGstin: true, gstinActive: true, needs: ["uptime" as never] };

describe("Network Reality Check", () => {
  it("is deterministic per pincode and flags itself as simulated", () => {
    const a = checkNetwork("411016", "Pune"), b = checkNetwork("411016", "Pune");
    expect(a).toEqual(b);
    expect(a.ok && a.simulated).toBe(true);
  });
  it("known demo pincodes: 411001 fibre, 411016 falls back to 5G AirFiber", () => {
    const f = checkNetwork("411001", "Pune"), w = checkNetwork("411016", "Pune");
    expect(f.ok && f.recommended).toBe("fibre");
    expect(w.ok && w.recommended).toBe("airfiber");
  });
  it("rejects bad pincodes", () => {
    for (const bad of ["", "12", "abcdef", "000000"]) expect(checkNetwork(bad).ok).toBe(false);
  });
  it("AirFiber swap drops products that the catalogue says need a fixed line", () => {
    const r = adaptForAirFiber([{ productId: "P02" }, { productId: "P09" }, { productId: "P07" }]);
    expect(r.items.map((i) => i.productId)).toEqual(["P04", "P07"]);
    expect(r.removed).toEqual(["Backup 4G/5G Failover"]);
  });
});

describe("Installation scheduler", () => {
  it("offers future slots, never Sundays, and moves the install step", () => {
    const o = makeOrder(clinic);
    const slots = slotsFor(o);
    expect(slots.length).toBeGreaterThan(3);
    expect(slots.every((s) => new Date(s.date).getUTCDay() !== 0 && s.day > o.timeline.clockDay)).toBe(true);
    const r = scheduleInstall(o, slots[4].id);
    expect(r.ok).toBe(true);
    const internet = o.timeline.tracks.find((t) => t.key === "internet")!;
    expect(internet.steps.find((s) => s.key === "installed")!.dueDay).toBe(slots[4].day);
    const days = internet.steps.map((s) => s.dueDay);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
  it("allows two free reschedules and then hands over to a partner", () => {
    const o = makeOrder(clinic);
    const s = slotsFor(o, 40);
    expect(scheduleInstall(o, s[0].id).ok).toBe(true);
    for (let i = 0; i < MAX_RESCHEDULES; i++) expect(scheduleInstall(o, s[i + 1].id).ok).toBe(true);
    const r = scheduleInstall(o, s[5].id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/partner/i);
  });
  it("rejects an unknown slot", () => {
    expect(scheduleInstall(makeOrder(clinic), "2020-01-01|9 am – 12 pm").ok).toBe(false);
  });
});

describe("Continuity", () => {
  it("without a backup link an outage raises a ticket routed to the city partner", () => {
    const o = makeOrder(clinic);
    expect(hasFailover(o)).toBe(false);
    const inc = startOutage(o)!;
    expect(inc.failover).toBe(false);
    expect(o.tickets?.[0]).toMatchObject({ kind: "outage", slaHours: 4, assignedTo: "Malabar Net" });
    expect(startOutage(o)).toBeUndefined(); // already down
    endOutage(o);
    expect(o.outageActive).toBe(false);
    expect(o.tickets?.[0].status).toBe("Resolved");
  });
  it("adding Backup 4G/5G Failover re-prices the order and keeps the business online during an outage", () => {
    const o = makeOrder(clinic);
    const before = o.quote.monthlyWithGst;
    expect(addFailover(o)).toEqual({ ok: true, added: true });
    expect(o.quote.monthlyWithGst).toBeGreaterThan(before);
    expect(hasFailover(o)).toBe(true);
    expect(addFailover(o)).toEqual({ ok: true, added: false });
    const inc = startOutage(o)!;
    expect(inc).toMatchObject({ failover: true, switchSeconds: 8 });
    expect(o.tickets ?? []).toHaveLength(0);
  });
  it("failover is refused on 5G AirFiber (catalogue: needs a fixed line)", () => {
    const o = makeOrder({ ...clinic, fibreAvailable: false });
    expect(o.lines.some((l) => l.productId === "P04")).toBe(true);
    const r = addFailover(o);
    expect(r.ok).toBe(false);
  });
  it("break-even maths: loss = sales/hour x dependent% x hours", () => {
    const c = continuity(makeOrder(clinic), { salesPerHour: 1000, dependentPct: 50, hours: 4 });
    expect(c.estLossMonth).toBe(2000);
    expect(c.worthIt).toBe(c.estLossMonth > c.failoverMonthly);
  });
  it("speed below 80% of plan opens a ticket; at or above does not", () => {
    const o = makeOrder(clinic);
    const plan = o.lines.find((l) => ["P01", "P02"].includes(l.productId))!.productId === "P01" ? 100 : 300;
    expect(checkSpeed(o, plan * 0.79).ok).toBe(false);
    expect(o.tickets).toHaveLength(1);
    expect(checkSpeed(o, plan * 0.8).ok).toBe(true);
    expect(o.tickets).toHaveLength(1);
  });
  it("tickets get an SLA by kind", () => {
    const o = makeOrder(clinic);
    expect(createTicket(o, "billing", "x").slaHours).toBe(24);
    expect(createTicket(o, "no_internet", "x").slaHours).toBe(4);
  });
});

describe("Branch-in-a-Box", () => {
  let parent: Order;
  beforeAll(() => { parent = makeOrder(chain); });

  it("previews a per-site copy with the network result and what is reused", () => {
    const r = previewBranch(parent, { name: "Gangapur Road", city: "Nashik", pincode: "422001" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.kycReused).toBe(true);
    expect(r.preview.needs[0]).toMatch(/address proof/i);
    expect(r.preview.totalAfter).toBe(parent.quote.monthlyWithGst + r.preview.quote.monthlyWithGst);
    // per-site products are 1 at the new branch, not the head-office total of 8
    const fibre = r.preview.lines.find((l) => ["P02", "P04"].includes(l.productId));
    expect(fibre?.qty).toBe(1);
  });
  it("rejects cities Accel does not serve and bad pincodes", () => {
    expect(previewBranch(parent, { name: "x", city: "Atlantis", pincode: "422001" }).ok).toBe(false);
    expect(previewBranch(parent, { name: "x", city: "Nashik", pincode: "12" }).ok).toBe(false);
  });
  it("creates a branch order that reuses consent/KYC, starts activation and links back to the parent", () => {
    const r = createBranch(parent, { name: "Pune FC Road", city: "Pune", pincode: "411001" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.parentId).toBe(parent.id);
    expect(r.order.consentId).toBe(parent.consentId);
    expect(r.order.kyc).toBe(parent.kyc);
    expect(r.order.timeline.clockDay).toBe(0);
    expect(parent.branches?.[0]).toMatchObject({ id: r.order.id, city: "Pune" });
    expect(liveDay(r.order.timeline)).toBeGreaterThan(0);
    advance(r.order.timeline, 30);
    expect(r.order.timeline.clockDay).toBe(liveDay(r.order.timeline));
  });
  it("falls back to 5G AirFiber at an address without fibre and drops fixed-line-only products", () => {
    const r = previewBranch(parent, { name: "Aundh", city: "Pune", pincode: "411016" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.network.recommended).toBe("airfiber");
    expect(r.preview.lines.some((l) => ["P01", "P02", "P03"].includes(l.productId))).toBe(false);
    expect(r.preview.lines.some((l) => l.productId === "P04")).toBe(true);
    expect(r.preview.lines.some((l) => l.productId === "P09")).toBe(false);
  });
});
