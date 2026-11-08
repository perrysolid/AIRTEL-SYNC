import type { Role } from "./auth";
import { STATUSES, type LeadView } from "./crm";
import { customerForOrder } from "./customers";
import { withinWhatsAppWindow } from "./notify";
import { maskPhone } from "./privacy";
import { orderStage } from "./sales-data";
import { allLive } from "./tracker";
import { currentStaff, type SignedInStaff } from "./staff-session";
import type { Order } from "./store";

/**
 * JSON views for the staff portal (the separate staff/ app). Same records and rules as the
 * backend-rendered /sales pages: admins see everything, sales and partners see their own book.
 */

export async function staffOr401(roles?: Role[]): Promise<{ staff: SignedInStaff } | { res: Response }> {
  const staff = await currentStaff();
  if (!staff) return { res: Response.json({ error: "Sign in again." }, { status: 401 }) };
  if (roles && !roles.includes(staff.role)) return { res: Response.json({ error: staff.role === "admin" ? "The manager can view this but not change it." : "Your role can't do that." }, { status: 403 }) };
  return { staff };
}

export function leadRow(l: LeadView, names: Map<string, string>) {
  const r = l.row;
  return {
    id: l.id,
    business: r.business_name,
    type: r.business_type,
    segment: r.segment,
    city: r.city,
    region: l.region,
    language: r.preferred_language,
    source: r.lead_source,
    stage: r.stage_reached,
    dropReason: r.drop_reason || null,
    status: l.status,
    statusLabel: STATUSES[l.status],
    owner: l.owner,
    ownerName: names.get(l.owner) ?? l.owner,
    probability: l.score.probability,
    band: l.score.band,
    reasons: l.score.reasons,
    lastTouch: l.lastTouch ? { at: l.lastTouch.at, kind: l.lastTouch.kind, outcome: l.lastTouch.outcome ?? null } : null,
    nextAt: l.nextAt ?? null,
    touches: l.touches,
  };
}

/** Where this order's updates reach the owner right now. */
export function reachFor(o: Order) {
  const c = customerForOrder(o);
  const out: { channel: "whatsapp" | "telegram" | "web"; note: string }[] = [{ channel: "web", note: "Tracker page" }];
  if (o.botChat) out.push({ channel: o.botChat.channel, note: "The chat the order came from" });
  if (c && !c.demo && c.notify.whatsapp && !(o.botChat?.channel === "whatsapp"))
    out.push({ channel: "whatsapp", note: withinWhatsAppWindow(c.whatsappInboundAt) ? "Verified number, chat open" : process.env.WHATSAPP_UPDATE_TEMPLATE ? "Verified number, by template" : "Verified number; sends once they message us" });
  if (c?.telegramChatId && c.notify.telegram && !(o.botChat?.channel === "telegram")) out.push({ channel: "telegram", note: "Linked account" });
  return out;
}

export function orderRow(o: Order) {
  return {
    id: o.id,
    createdAt: o.createdAt,
    business: o.businessName,
    city: o.city ?? null,
    contact: o.contactName ?? null,
    phone: o.phone ? maskPhone(o.phone) : null,
    channel: o.channel,
    partnerCode: o.partnerCode ?? null,
    leadId: o.leadId ?? null,
    monthly: o.quote.monthly,
    monthlyWithGst: o.quote.monthlyWithGst,
    stage: orderStage(o),
    live: allLive(o.timeline),
    lastUpdate: o.notifications.at(-1) ?? null,
    updates: o.notifications.length,
  };
}
