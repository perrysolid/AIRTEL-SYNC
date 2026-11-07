import { datasets, type LeadRow } from "./data";
import { publicUrl } from "./bots/types";

/**
 * Win-back: 61% of lost leads never got advice (unreachable, or the owner had
 * no time for a sales visit). Each gets a personal self-serve link; opening it
 * starts the WhatsApp/Telegram advisor with their CRM details already filled
 * in, so they see a priced plan in a minute without a call or a visit.
 */

export const WINBACK_REASONS = [
  "Unreachable after 3 attempts",
  "Owner had no time for a visit",
  "Visit not scheduled by sales",
  "Quote took too long to arrive",
  "Quote too complex to understand",
] as const;

export const WHATSAPP_NUMBER = () => (process.env.WHATSAPP_DISPLAY_NUMBER ?? "15551369092").replace(/\D/g, "");
export const TELEGRAM_BOT = () => process.env.TELEGRAM_BOT_USERNAME ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "UdyamAdvisorBot";

/** A lead code (L00042) or a referral code (REF-ACC-…) inside a chat message or /start payload. */
export function startCode(text: string): { lead?: string; referral?: string } {
  const ref = text.match(/\bREF-(ACC-[A-F0-9]{10})\b/i);
  if (ref) return { referral: ref[1].toUpperCase() };
  const lead = text.match(/\b(L\d{5})\b/i);
  return lead ? { lead: lead[1].toUpperCase() } : {};
}

/** Deep links that open our bot with the code pre-typed (WhatsApp) or as the /start payload (Telegram). */
export function botLinks(code: string, greeting = "Hi Udyam, show my plan") {
  return {
    whatsapp: `https://wa.me/${WHATSAPP_NUMBER()}?text=${encodeURIComponent(`${greeting} ${code}`)}`,
    telegram: `https://t.me/${TELEGRAM_BOT()}?start=${encodeURIComponent(code)}`,
  };
}

export interface WinbackLead {
  leadId: string;
  businessName: string;
  businessType: string;
  city: string;
  language: string;
  segment: string;
  stage: string;
  dropReason: string;
  links: { whatsapp: string; telegram: string; web: string };
  message: string;
}

function firstName(full: string) {
  return full.split(" ")[0] || "there";
}

/** The outreach text (SMS, or an approved WhatsApp utility template in production). */
export function winbackMessage(lead: LeadRow, link: string) {
  return `Namaste ${firstName(lead.contact_name)}! Your Accel Business plan for ${lead.business_name} is ready — prices in 1 minute, no visit needed. Tap to see it on WhatsApp: ${link}`;
}

function toWinback(l: LeadRow): WinbackLead {
  const links = { ...botLinks(l.lead_id), web: publicUrl(`/advisor?lead=${l.lead_id}`) };
  return {
    leadId: l.lead_id,
    businessName: l.business_name,
    businessType: l.business_type,
    city: l.city,
    language: l.preferred_language,
    segment: l.segment,
    stage: l.stage_reached,
    dropReason: l.drop_reason,
    links,
    message: winbackMessage(l, links.whatsapp),
  };
}

export function winbackSummary(limit = 50) {
  const leads = datasets().leads.filter((l) => l.outcome === "Dropped" && (WINBACK_REASONS as readonly string[]).includes(l.drop_reason));
  const byReason = WINBACK_REASONS.map((reason) => ({ reason, count: leads.filter((l) => l.drop_reason === reason).length }));
  // Bigger businesses first: they are worth the most per win.
  const ranked = [...leads].sort((a, b) => Number(b.employee_count) * Number(b.num_sites) - Number(a.employee_count) * Number(a.num_sites));
  return { total: leads.length, byReason, leads: ranked.slice(0, limit).map(toWinback) };
}
