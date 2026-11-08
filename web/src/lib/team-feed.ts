import { activitySince, canSee, leadViews, listStaff, STATUSES } from "./crm";
import { chatSummary } from "./chat-summary";
import { inr } from "./format";
import { ordersFor } from "./sales-data";
import type { SignedInStaff } from "./staff-session";
import { store } from "./store";
import { liveDay } from "./tracker";

/**
 * One timeline of everything that happened across the business: what salespeople and partners did, what owners did
 * with their orders, and conversations the advisor could not close. Managers see all of it; a salesperson or partner
 * sees their own book.
 */
export interface FeedEvent {
  at: string;
  kind: "call" | "whatsapp" | "note" | "status" | "assign" | "order" | "verified" | "signed" | "live" | "paid" | "message" | "handoff" | "quoted";
  who: string;
  title: string;
  detail?: string;
  href?: string;
}

export async function teamFeed(staff: SignedInStaff, days = 7, limit = 120): Promise<FeedEvent[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const sinceIso = since.toISOString();
  const [views, people] = await Promise.all([leadViews(), listStaff()]);
  const name = new Map(people.map((p) => [p.id, p.name]));
  const out: FeedEvent[] = [];

  for (const a of await activitySince(since)) {
    const lead = views.get(a.leadId);
    if (!lead || !canSee(staff, lead)) continue;
    const business = lead.row.business_name;
    const who = name.get(a.staffId) ?? a.staffId;
    const title =
      a.kind === "call" ? `called ${business}: ${a.outcome ?? "logged"}`
      : a.kind === "whatsapp" ? `sent ${business} their personal link on WhatsApp`
      : a.kind === "assign" ? `moved ${business} to ${name.get(a.note) ?? a.note}`
      : a.kind === "status" ? `marked ${business} as ${a.status ? STATUSES[a.status].toLowerCase() : "updated"}`
      : `added a note on ${business}`;
    const detail = [a.status && a.kind !== "status" && `Now ${STATUSES[a.status].toLowerCase()}`, a.kind !== "assign" && a.note, a.nextAt && `Follow-up ${new Date(a.nextAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`].filter(Boolean).join(" · ");
    out.push({ at: a.at, kind: a.kind, who, title, detail: detail || undefined, href: `/leads/${a.leadId}` });
  }

  for (const o of await ordersFor(staff)) {
    const href = `/orders/${o.id}`;
    const biz = o.businessName;
    if (o.createdAt >= sinceIso) out.push({ at: o.createdAt, kind: "order", who: biz, title: `ordered ${inr(o.quote.monthlyWithGst)}/month`, detail: `${o.lines.map((l) => l.name).join(", ")} · via ${o.partnerCode ? `partner ${o.partnerCode}` : o.channel}`, href });
    if (o.kyc?.result.verdict === "verified" && o.kyc.at >= sinceIso) out.push({ at: o.kyc.at, kind: "verified", who: biz, title: "was verified (GST and Udyam)", href });
    if (o.esign && o.esign.at >= sinceIso) out.push({ at: o.esign.at, kind: "signed", who: biz, title: "signed the agreement; installation started", href });
    const live = o.timeline.clockDay >= liveDay(o.timeline) && o.notifications.find((n) => n.text.startsWith("🎉"));
    if (live && live.at >= sinceIso) out.push({ at: live.at, kind: "live", who: biz, title: "is fully live", href });
    if (o.payment && o.payment.at >= sinceIso) out.push({ at: o.payment.at, kind: "paid", who: biz, title: `paid the first bill, ${inr(o.payment.amount)}`, href });
    for (const n of o.notifications) {
      if (!n.text.startsWith("📣") || n.at < sinceIso) continue;
      const [text, sign] = n.text.slice(2).trim().split("\n— ");
      out.push({ at: n.at, kind: "message", who: sign?.split(",")[0] ?? "Staff", title: `messaged ${biz}`, detail: text, href });
    }
  }

  // Conversations nobody closed, with what happened in them. Partners work their own leads, not the advisor's.
  if (staff.role !== "partner") {
    for (const s of store.listSessions()) {
      if (s.updatedAt < sinceIso || s.status === "ordered" || (s.status !== "handoff" && !s.quote)) continue;
      if (staff.role === "sales" && s.leadId && views.get(s.leadId)?.owner !== staff.id) continue;
      const sum = await chatSummary(s);
      const biz = s.profile.businessName ?? s.profile.businessType ?? "A business";
      out.push(
        s.status === "handoff"
          ? { at: s.handoff?.at ?? s.updatedAt, kind: "handoff", who: biz, title: "asked to talk to a person", detail: sum.headline, href: "/chats" }
          : { at: s.updatedAt, kind: "quoted", who: biz, title: `got a plan (${inr(s.quote!.monthlyWithGst)}/month) but didn't order`, detail: sum.headline, href: "/chats" },
      );
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
