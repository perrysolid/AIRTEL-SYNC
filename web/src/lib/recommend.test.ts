import { describe, expect, it } from "vitest";
import { catalogue, product } from "./catalogue";
import { buildQuote, unitPrice } from "./pricing";
import { checkEligibility, recommend } from "./recommend";
import { ProfileSchema, type Profile } from "./profile";

const P = (p: Partial<Profile>) => ProfileSchema.parse({ needs: [], ...p });
const ids = (r: ReturnType<typeof recommend>, includeOptional = false) =>
  r.lines.filter((l) => includeOptional || !l.optional).map((l) => l.productId);
const excludedIds = (r: ReturnType<typeof recommend>) => r.excluded.map((e) => e.productId);

/** Every recommended line must satisfy every catalogue rule. */
function assertAllEligible(r: ReturnType<typeof recommend>, profile: Profile) {
  const all = ids(r, true);
  for (const id of all) {
    const e = checkEligibility(product(id), profile, all);
    expect(e.ok, `${id}: ${e.reasons.join("; ")}`).toBe(true);
  }
}

// Scenarios modelled on the kinds of live tests a judge would run.
const scenarios: { name: string; profile: Partial<Profile>; requested?: string[]; has?: string[]; not?: string[]; excluded?: string[] }[] = [
  { name: "kirana, tier 2, no GSTIN, wants UPI + WhatsApp", profile: { businessType: "Kirana store", cityTier: 2, employees: 2, sites: 1, hasGstin: false, needs: ["internet", "whatsapp", "pos_billing"] }, has: ["P01", "P19"], not: ["P15"], excluded: ["P15"] },
  { name: "kirana with GSTIN gets WhatsApp API", profile: { businessType: "Kirana store", cityTier: 2, employees: 2, hasGstin: true, needs: ["whatsapp"] }, has: ["P01", "P15"] },
  { name: "tier-2 clinic asks for 1 Gbps", profile: { businessType: "Dental clinic", cityTier: 2, employees: 8, hasGstin: true }, requested: ["P03"], not: ["P03"], excluded: ["P03"], has: ["P02"] },
  { name: "tier-1 clinic with 6 staff can get 1 Gbps", profile: { businessType: "Dental clinic", cityTier: 1, employees: 6, hasGstin: true }, requested: ["P03"], has: ["P03"] },
  { name: "1 Gbps needs 5+ employees", profile: { businessType: "CA firm", cityTier: 1, employees: 3, hasGstin: true }, requested: ["P03"], excluded: ["P03"] },
  { name: "SD-WAN refused below 3 sites", profile: { businessType: "Restaurant chain", cityTier: 1, employees: 40, sites: 2, hasGstin: true, needs: ["multi_site_management"] }, not: ["P10"], excluded: ["P10"] },
  { name: "SD-WAN refused below 10 employees", profile: { businessType: "Bakery chain", cityTier: 2, employees: 8, sites: 3, hasGstin: true, needs: ["multi_site_management"] }, excluded: ["P10"] },
  { name: "SD-WAN offered for a 5-store chain", profile: { businessType: "Apparel retail chain", cityTier: 1, employees: 31, sites: 5, hasGstin: true, needs: ["multi_site_management"] }, has: ["P02", "P10"] },
  { name: "SD-WAN needs GSTIN", profile: { businessType: "Gym chain", cityTier: 2, employees: 30, sites: 4, hasGstin: false, needs: ["multi_site_management"] }, excluded: ["P10"] },
  { name: "leased line needs 10 employees", profile: { businessType: "Packaging unit", cityTier: 2, employees: 8, hasGstin: true }, requested: ["P05"], excluded: ["P05"] },
  { name: "manufacturer with 20 staff gets leased line", profile: { businessType: "Auto-parts unit", cityTier: 2, employees: 20, hasGstin: true }, has: ["P05"] },
  { name: "100 Mbps leased line needs 25 employees", profile: { businessType: "Textile unit", cityTier: 2, employees: 20, hasGstin: true }, requested: ["P06"], excluded: ["P06"] },
  { name: "leased line refused without GSTIN", profile: { businessType: "Auto-parts unit", cityTier: 2, employees: 30, hasGstin: false }, requested: ["P05"], excluded: ["P05"], has: ["P02"] },
  { name: "no fibre at site -> 5G AirFiber", profile: { businessType: "Salon", cityTier: 2, employees: 3, fibreAvailable: false, needs: ["cctv"] }, has: ["P04", "P23"], not: ["P01"] },
  { name: "static IP can't ride on AirFiber", profile: { businessType: "Salon", cityTier: 2, employees: 3, fibreAvailable: false, needs: ["static_ip"] }, excluded: ["P11"] },
  { name: "cloud telephony needs 3+ employees", profile: { businessType: "Travel agency", cityTier: 1, employees: 2, hasGstin: true, needs: ["business_phone"] }, excluded: ["P12"] },
  { name: "cloud telephony for 12-person CA firm", profile: { businessType: "CA firm", cityTier: 1, employees: 12, hasGstin: true, needs: ["business_phone", "email"] }, has: ["P02", "P12", "P16"] },
  { name: "firewall needs 10 employees", profile: { businessType: "Law office", cityTier: 1, employees: 6, hasGstin: true, needs: ["firewall"] }, excluded: ["P21"] },
  { name: "SMS needs GSTIN", profile: { businessType: "Coaching centre", cityTier: 2, employees: 6, hasGstin: false, needs: ["sms"] }, excluded: ["P14"] },
  { name: "cancelled GSTIN treated as no GSTIN", profile: { businessType: "Travel agency", cityTier: 2, employees: 5, hasGstin: true, gstinActive: false, needs: ["whatsapp", "toll_free"] }, excluded: ["P15", "P13"] },
  { name: "machine IoT for manufacturer", profile: { businessType: "Plastic moulding unit", cityTier: 2, employees: 40, hasGstin: true, needs: ["machine_monitoring"], machines: 6 }, has: ["P24"] },
  { name: "fleet tracker has no size limit", profile: { businessType: "Bakery", cityTier: 2, employees: 2, needs: ["fleet_tracking"], vehicles: 1 }, has: ["P25"] },
  { name: "mobile-only owner still gets a working bundle", profile: { businessType: "Mobile repair shop", cityTier: 2, employees: 1, needs: ["mobile_lines"], mobileLines: 2 }, has: ["P07"] },
  { name: "declined primary removes dependent add-ons", profile: { businessType: "Pharmacy", cityTier: 2, employees: 3, needs: ["cctv"] }, has: ["P01", "P23"] },
];

describe("advisor scenarios", () => {
  for (const s of scenarios) {
    it(s.name, () => {
      const profile = P(s.profile);
      const r = recommend({ profile, requestedProducts: s.requested });
      for (const id of s.has ?? []) expect(ids(r), `expected ${id}`).toContain(id);
      for (const id of s.not ?? []) expect(ids(r, true), `unexpected ${id}`).not.toContain(id);
      for (const id of s.excluded ?? []) expect(excludedIds(r), `expected exclusion ${id}`).toContain(id);
      for (const e of r.excluded) expect(e.reason.length).toBeGreaterThan(5);
      assertAllEligible(r, profile);
    });
  }

  it("always includes exactly one internet link per bundle", () => {
    for (const s of scenarios) {
      const r = recommend({ profile: P(s.profile), requestedProducts: s.requested });
      const links = ids(r).filter((id) => ["P01", "P02", "P03", "P04", "P05", "P06"].includes(id));
      expect(links.length, s.name).toBe(1);
    }
  });

  it("flags cities outside tier 1-2", () => {
    const r = recommend({ profile: P({ businessType: "Kirana", city: "Shimla", employees: 2 }) });
    expect(r.notes.join(" ")).toMatch(/don't sell in Shimla/);
  });

  it("per-site products scale with sites", () => {
    const r = recommend({ profile: P({ businessType: "Restaurant chain", cityTier: 1, employees: 60, sites: 6, hasGstin: true, needs: ["backup_internet"] }) });
    expect(r.lines.find((l) => l.productId === "P02")?.qty).toBe(6);
    expect(r.lines.find((l) => l.productId === "P09")?.qty).toBe(6);
  });

  it("every catalogue product is reachable by some scenario or request", () => {
    const big = P({ businessType: "Auto-parts unit", cityTier: 1, employees: 60, sites: 4, hasGstin: true, needs: [] });
    for (const id of catalogue().keys()) {
      const r = recommend({ profile: big, requestedProducts: [id] });
      expect([...ids(r, true), ...excludedIds(r)], id).toContain(id);
    }
  });
});

describe("pricing", () => {
  const rec = recommend({ profile: P({ businessType: "Salon", cityTier: 2, employees: 3, hasGstin: true, needs: ["whatsapp", "pos_billing", "cctv"] }) });

  it("prices fall with longer terms and stay inside the catalogue band", () => {
    for (const p of catalogue().values()) {
      const [a, b, c] = [unitPrice(p.id, 12), unitPrice(p.id, 24), unitPrice(p.id, 36)];
      expect(a).toBe(p.priceMax);
      expect(c).toBe(p.priceMin);
      expect(b).toBeGreaterThanOrEqual(c);
      expect(b).toBeLessThanOrEqual(a);
    }
  });

  it("gives a single monthly price with GST shown separately", () => {
    const q = buildQuote({ lines: rec.lines, term: 12 });
    expect(q.monthly).toBe(q.subtotal - q.oneBillDiscount);
    expect(q.monthlyWithGst).toBe(q.monthly + Math.round(q.monthly * 0.18));
  });

  it("applies the One Bill discount at 3+ categories", () => {
    const q = buildQuote({ lines: rec.lines, term: 12 });
    expect(q.categories).toBeGreaterThanOrEqual(3);
    expect(q.oneBillDiscount).toBe(Math.round(q.subtotal * 0.05));
  });

  it("toggling an add-on changes the total", () => {
    const opt = rec.lines.find((l) => l.optional)!;
    const off = buildQuote({ lines: rec.lines });
    const on = buildQuote({ lines: rec.lines, toggles: { [opt.productId]: true } });
    expect(on.subtotal).toBeGreaterThan(off.subtotal);
  });

  it("switching off the internet line blocks dependent products", () => {
    const q = buildQuote({ lines: rec.lines, toggles: { P01: false } });
    expect(q.lines.find((l) => l.productId === "P23")?.blockedReason).toBeTruthy();
    expect(q.lines.filter((l) => l.blockedReason).every((l) => !q.lines.some((x) => x === l && x.monthly === 0))).toBe(true);
  });

  it("enforces the longest minimum contract", () => {
    const r = recommend({ profile: P({ businessType: "Apparel retail chain", cityTier: 1, employees: 31, sites: 5, hasGstin: true, needs: ["multi_site_management"] }) });
    const q = buildQuote({ lines: r.lines, term: 12 });
    expect(q.term).toBe(24);
    expect(q.allowedTerms).toEqual([24, 36]);
  });

  it("micro bundles land near the ₹2,500 micro average", () => {
    const r = recommend({ profile: P({ businessType: "Kirana store", cityTier: 2, employees: 2, hasGstin: true, needs: ["pos_billing", "mobile_lines"] }) });
    const q = buildQuote({ lines: r.lines, term: 12 });
    expect(q.monthly).toBeGreaterThan(1500);
    expect(q.monthly).toBeLessThan(4000);
  });
});
