import type { Profile } from "./profile";
// Type-only import: this file is also used by client components, so it must not pull in the server-side data loader.
import type { SegmentKey } from "./catalogue";

/** Static copy for the marketing pages. Every price and statistic on those pages is computed live from the catalogue and lead data. */

export interface Persona {
  id: string;
  emoji: string;
  name: string;
  blurb: string;
  segment: SegmentKey;
  profile: Profile;
}

export const PERSONAS: Persona[] = [
  { id: "kirana", emoji: "🛒", name: "Raju's Kirana", blurb: "Pune · 3 staff · mobile hotspot", segment: "micro", profile: { businessType: "Kirana store", city: "Pune", cityTier: 1, employees: 3, sites: 1, hasGstin: false, currentInternet: "Mobile hotspot", monthlySpend: 1500, needs: ["pos_billing", "whatsapp"] } },
  { id: "clinic", emoji: "🦷", name: "Harmony Dental", blurb: "Kochi · 15 staff · GSTIN", segment: "prof", profile: { businessType: "Dental clinic", city: "Kochi", cityTier: 2, employees: 15, sites: 1, hasGstin: true, gstinActive: true, currentInternet: "Home broadband", monthlySpend: 4200, needs: ["email", "cloud_backup", "device_security"] } },
  { id: "chain", emoji: "🍽️", name: "Spice Route Chain", blurb: "Delhi · 8 outlets · 60 staff", segment: "multi", profile: { businessType: "Restaurant chain", city: "Delhi", cityTier: 1, employees: 60, sites: 8, hasGstin: true, gstinActive: true, currentInternet: "Mixed per site", monthlySpend: 24000, needs: ["cctv", "backup_internet", "pos_billing"] } },
  { id: "factory", emoji: "🏭", name: "Nashik Auto Parts", blurb: "Nashik · 80 staff · GSTIN", segment: "mfg", profile: { businessType: "Auto-parts unit", city: "Nashik", cityTier: 2, employees: 80, sites: 1, hasGstin: true, gstinActive: true, currentInternet: "Leased line", monthlySpend: 30000, needs: ["machine_monitoring", "device_security"] } },
];

export const SEGMENT_COPY: Record<SegmentKey, { icon: string; who: string; share: string; pain: string[]; plan: string[]; persona: string }> = {
  micro: {
    icon: "🛒", who: "Kirana, salon, pharmacy, bakery, boutique", share: "55% of the SMB base",
    pain: ["UPI and billing fail on a mobile hotspot", "Very price-sensitive: about ₹2,500/month is the ceiling", "Most have no GSTIN, which locks them out of some products"],
    plan: ["5G AirFiber live in about 2 days", "WhatsApp-first journey, no visit", "A GSTIN-free bundle plus a nudge to unlock more"], persona: "kirana",
  },
  prof: {
    icon: "🩺", who: "Clinics, CA firms, coaching centres, law offices", share: "25% of the SMB base",
    pain: ["Home broadband and personal Gmail", "Downtime and data security worry them", "Highest activation today: the easiest first win"],
    plan: ["Fibre + business SIMs + email + endpoint security", "Backup and secure Wi-Fi as one-tap add-ons", "A CA channel: one accountant onboards many clients"], persona: "clinic",
  },
  multi: {
    icon: "🏪", who: "Restaurant chains, 3–10 store retailers, gyms, pre-schools", share: "15% of the SMB base",
    pain: ["A different ISP at every site, no central IT", "One site down means lost sales that day", "The highest bundle value of any segment"],
    plan: ["One bill, backup link at every site", "Branch-in-a-Box clones a store setup in one tap", "Partner-led installs with digital quote and KYC"], persona: "chain",
  },
  mfg: {
    icon: "🏭", who: "Auto-parts, textile, plastics, packaging units", share: "5% of the SMB base",
    pain: ["Need dedicated bandwidth and uptime for ERP", "Site surveys make the journey slow", "Low price sensitivity, high lifetime value"],
    plan: ["Leased line with an SLA, managed firewall", "IoT machine monitoring as an add-on", "Assisted journey: digital discovery, KYC and tracking"], persona: "factory",
  },
};

export const FAQ: { cat: string; q: string; a: string }[] = [
  { cat: "Buying", q: "How much will I pay every month?", a: "You see one monthly price before you commit, including 18% GST. Every product shows its price per unit, and you can switch add-ons on or off and watch the total change. The longer you commit (12, 24 or 36 months), the lower the rate." },
  { cat: "Buying", q: "What if I don't have a GSTIN?", a: "You can still buy everything that does not need one: fibre, 5G AirFiber, business SIMs, email, backup, POS and more. Products such as the WhatsApp Business API and leased lines need an active GSTIN. If you add one later, they unlock." },
  { cat: "Buying", q: "Is there a lock-in?", a: "Contract lengths are set per product: 1 month for SIMs, 6 months for 5G AirFiber, 12 months for most products and 24 for a few. Your quote shows the commitment you choose and what it changes." },
  { cat: "Buying", q: "Do I need to meet a salesperson?", a: "No. The advisor, quote, KYC and e-sign all happen on your phone. For dedicated links we book a short video call for the site survey, and a local partner can help on the ground if you want." },
  { cat: "KYC & privacy", q: "Which documents do you need?", a: "GST certificate, Udyam certificate (optional), the signatory's ID and an address proof no older than 90 days. You can also fetch them through DigiLocker." },
  { cat: "KYC & privacy", q: "What happens to my documents?", a: "We ask your consent first, read only the fields each check needs, mask identifiers on screen and in logs, and never store the document images. You can withdraw consent or ask for erasure from your order page." },
  { cat: "KYC & privacy", q: "Why was my KYC flagged?", a: "We tell you exactly why: for example a cancelled GSTIN, a typo that fails the GSTIN check digit, a name mismatch between documents or an old utility bill. Fix it and retry, or a partner can help." },
  { cat: "Installation", q: "How long does installation take?", a: "SIMs, email and cloud products are instant. 5G AirFiber takes about 2 days, fibre about 5 and leased lines 3–4 weeks. Before you pay, the Network Reality Check tells you what is possible at your pincode." },
  { cat: "Installation", q: "Can I change my installation time?", a: "Yes, from your order page (Install slot tab) or by replying RESCHEDULE in chat. You get two free reschedules." },
  { cat: "Support", q: "What if my internet goes down?", a: "SYNC spots the outage, raises a ticket automatically and routes it to the right partner for your city. With a backup link you stay online while the main line is fixed." },
  { cat: "Support", q: "How do I check if a message is a scam?", a: "Paste it or upload a screenshot in Scam Shield, or forward it to the bot on WhatsApp or Telegram. We explain the red flags and what to do. A screenshot is not proof of payment, so check your bank or UPI app." },
  { cat: "Support", q: "Can I add another shop later?", a: "Yes. Branch-in-a-Box copies your setup to the new address, reuses your verified KYC and only asks for the new address proof." },
];

/** Why prospects dropped out (as written in the lead data) → what the journey does about it. */
export const DROP_FIXES: { reason: string; fix: string }[] = [
  { reason: "Price too high", fix: "Transparent bundle price, longer-term rates, a GSTIN-free starter and savings vs list price" },
  { reason: "Quote too complex to understand", fix: "One monthly price in plain language, in your language, with the reason for every line" },
  { reason: "Quote took too long to arrive", fix: "An instant quote from the advisor: minutes instead of 3–5 days" },
  { reason: "Owner had no time for a visit", fix: "No visit needed: chat, KYC and e-sign on the phone" },
  { reason: "Missing GST or Udyam document", fix: "Registry lookup by GSTIN and DigiLocker, with specific retake hints" },
  { reason: "Document details did not match", fix: "Cross-document checks that say exactly what differs, before you submit" },
  { reason: "Authorised signatory not available", fix: "Consent and e-sign captured on the signatory's own phone" },
  { reason: "Installation delayed beyond 21 days", fix: "Network Reality Check, 5G AirFiber fallback (2 days) and a self-serve slot scheduler" },
  { reason: "Site not feasible for fibre", fix: "A pincode check before payment, with an automatic wireless fallback" },
];
