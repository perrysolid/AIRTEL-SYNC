import { product } from "@/lib/catalogue";
import { buildQuote } from "@/lib/pricing";
import { inferSegment, tierForCity, type Profile } from "@/lib/profile";
import { recommend } from "@/lib/recommend";
import { newSession } from "@/lib/advisor";
import { currentCustomer } from "@/lib/customer-session";
import { now, store } from "@/lib/store";

export const runtime = "nodejs";

/** Ready-made plans for the most common kinds of business, priced by the same rules and engine as a custom quote. */
const PLANS: { key: string; name: string; for: string; tagline: string; start: string; profile: Profile }[] = [
  {
    key: "kirana",
    name: "Dukaan Starter",
    for: "Kirana & retail shops",
    tagline: "Steady internet at the counter, UPI billing, WhatsApp orders and a camera on the shop.",
    start: "I run a kirana store with 3 people, I need billing, WhatsApp and CCTV",
    profile: { businessType: "Kirana store", employees: 3, sites: 1, hasGstin: true, needs: ["internet", "pos_billing", "whatsapp", "cctv", "mobile_lines"] },
  },
  {
    key: "cafe",
    name: "Café & Restaurant",
    for: "Restaurants, cafés & salons",
    tagline: "Fast billing at the counter, Wi-Fi for guests, cameras on the floor and a channel for repeat customers.",
    start: "I run a restaurant with 8 people, I need billing, guest Wi-Fi and CCTV",
    profile: { businessType: "Restaurant", employees: 8, sites: 1, hasGstin: true, needs: ["internet", "pos_billing", "guest_wifi", "cctv", "whatsapp", "backup_internet"] },
  },
  {
    key: "office",
    name: "Smart Office",
    for: "CA firms, clinics & small offices",
    tagline: "Uptime for client work, business email and backups, protected devices and a proper office line.",
    start: "I run a CA firm with 12 people, I need email, backups, security and a phone line",
    profile: { businessType: "CA firm", employees: 12, sites: 1, hasGstin: true, needs: ["internet", "backup_internet", "email", "cloud_backup", "device_security", "business_phone"] },
  },
  {
    key: "group",
    name: "Business Group",
    for: "Chains & multi-store businesses",
    tagline: "Every branch on one bill and one dashboard, with cameras, billing and a backup line at each site.",
    start: "I run 4 stores with 25 people, I need all branches managed centrally with CCTV and billing",
    profile: { businessType: "Retail chain", employees: 25, sites: 4, hasGstin: true, needs: ["internet", "multi_site_management", "pos_billing", "cctv", "backup_internet", "firewall"] },
  },
  {
    key: "factory",
    name: "Factory Floor",
    for: "Small manufacturers",
    tagline: "Dedicated bandwidth, machine monitoring, a secured network and phones for the shift team.",
    start: "I run a small factory with 60 people, I need a leased line, machine monitoring and CCTV",
    profile: { businessType: "Manufacturing unit", employees: 60, sites: 1, hasGstin: true, needs: ["internet", "machine_monitoring", "cctv", "firewall", "static_ip", "mobile_lines"] },
  },
];

/** The plan's typical business, priced for a tier-1 city (the owner checks their pincode on the quote page). */
function planProfile(p: (typeof PLANS)[number]): Profile {
  const profile: Profile = { ...p.profile, cityTier: tierForCity("Pune") };
  profile.segment = inferSegment(profile);
  return profile;
}

export async function GET() {
  const plans = PLANS.map((p) => {
    const profile = planProfile(p);
    const rec = recommend({ profile });
    const longest = buildQuote({ lines: rec.lines, term: 36 });
    const shortest = buildQuote({ lines: rec.lines, term: 12 });
    const items = shortest.lines.filter((l) => l.active).map((l) => ({ id: l.productId, name: l.name, category: product(l.productId).category, qty: l.qty }));
    return {
      key: p.key,
      name: p.name,
      for: p.for,
      tagline: p.tagline,
      start: p.start,
      items,
      priceFrom: Math.round(Math.min(longest.monthlyWithGst, shortest.monthlyWithGst)),
      priceTo: Math.round(Math.max(longest.monthlyWithGst, shortest.monthlyWithGst)),
      setupFrom: Math.round(Math.min(longest.setupTotal, shortest.setupTotal)),
      setupTo: Math.round(Math.max(longest.setupTotal, shortest.setupTotal)),
      liveInDays: shortest.allLiveInDays,
    };
  });
  return Response.json({ plans }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

/**
 * "Get this plan": opens the plan as an editable quote straight away, instead of asking the advisor to rebuild it
 * question by question. 36 months, the term the card's "from" price is quoted on; the owner can change anything.
 */
export async function POST(req: Request) {
  const key = ((await req.json().catch(() => ({}))) as { key?: string }).key;
  const p = PLANS.find((x) => x.key === key);
  if (!p) return Response.json({ error: "Unknown plan" }, { status: 404 });
  const s = newSession("web", "en");
  s.profile = { ...s.profile, ...planProfile(p) };
  s.recommendation = recommend({ profile: s.profile });
  s.quote = buildQuote({ lines: s.recommendation.lines, term: 36 });
  s.status = "quoted";
  s.transcript.push({ role: "user", text: `Chose the "${p.name}" plan on the website.`, at: now() });
  const c = await currentCustomer();
  if (c) s.customerId = c.id;
  store.saveSession(s);
  return Response.json({ sessionId: s.id });
}
