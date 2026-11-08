import { NEED_LABELS, type Need } from "@/lib/profile";
import { callList, leadSummary } from "@/lib/analytics";
import { maskName, maskPhone } from "@/lib/privacy";
import { store } from "@/lib/store";
import { summarize } from "@/lib/advisor";
import { liveDay } from "@/lib/tracker";
import { winbackSummary } from "@/lib/winback";
import { cookies } from "next/headers";
import { readToken, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Back-office data for field sales and channel partners. PII stays masked. */
export async function GET() {
  const who = readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!who || who.role === "partner") return Response.json({ error: "Sign in to the sales portal" }, { status: 401 });
  const sessions = store.listSessions().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const orders = store.listOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unclosed = sessions
    .filter((s) => s.status === "handoff" || (s.status === "quoted" && Date.now() - new Date(s.updatedAt).getTime() > 2 * 60_000) || (s.status === "open" && s.transcript.length > 2))
    .slice(0, 40)
    .map((s) => ({
      id: s.id,
      status: s.status,
      channel: s.channel,
      language: s.language,
      updatedAt: s.updatedAt,
      summary: s.handoff?.summary || summarize(s),
      reason: s.handoff?.reason ?? (s.status === "quoted" ? "Got a quote but didn't order" : "Dropped mid-conversation"),
      lastOwnerMessage: readable([...s.transcript].reverse().find((t) => t.role === "user" && t.text)?.text)?.slice(0, 140),
      quoteMonthly: s.quote?.monthly,
      canNudge: !!s.botChat && !!s.quote && s.status !== "handoff",
    }));

  const wb = winbackSummary(30);
  return Response.json({
    winback: {
      ...wb,
      results: {
        resumed: sessions.filter((s) => s.leadId).length,
        quoted: sessions.filter((s) => s.leadId && s.quote).length,
        ordered: orders.filter((o) => o.leadId).length,
        referred: orders.filter((o) => o.referredBy).length,
      },
    },
    summary: leadSummary(),
    callList: callList(25).map(({ lead, score }) => ({
      id: lead.lead_id,
      business: lead.business_name,
      type: lead.business_type,
      city: lead.city,
      segment: lead.segment,
      language: lead.preferred_language,
      contact: maskName(lead.contact_name),
      stage: lead.stage_reached,
      dropReason: lead.drop_reason,
      source: lead.lead_source,
      probability: score.probability,
      band: score.band,
      reasons: score.reasons,
    })),
    unclosed,
    orders: orders.slice(0, 40).map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      business: o.businessName,
      city: o.city,
      phone: maskPhone(o.phone),
      channel: o.channel,
      partnerCode: o.partnerCode,
      monthly: o.quote.monthly,
      kyc: o.kyc?.result.verdict ?? "pending",
      kycIssues: o.kyc?.result.checks?.filter((c) => c.status === "fail").map((c) => c.title) ?? [],
      stage: o.timeline.clockDay >= 0 ? (o.timeline.clockDay >= liveDay(o.timeline) ? (o.payment ? "Live" : "Live, first bill due") : `Activating (day ${o.timeline.clockDay}/${liveDay(o.timeline)})`) : o.kyc?.result.verdict === "verified" ? "Awaiting e-sign" : "KYC",
    })),
    service: {
      activeOutages: orders.filter((o) => o.outageActive).length,
      branches: orders.filter((o) => o.parentId).length,
      booked: orders.filter((o) => o.slot).length,
      tickets: orders.flatMap((o) => (o.tickets ?? []).map((t) => ({ ...t, orderId: o.id, business: o.businessName, city: o.city }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    },
    consents: { total: store.listConsents().length, ledgerHead: store.listConsents().at(-1)?.hash.slice(0, 16) },
    audit: store.listAudit().slice(-25).reverse(),
  });
}

/** Chip replies are stored as codes ("needs:cctv,email"); show them as the owner saw them. */
function readable(text?: string) {
  const m = text?.match(/^(type|city|emp|sites|gst|needs):(.*)$/);
  if (!m) return text;
  if (m[1] === "needs") return m[2].split(",").map((n) => NEED_LABELS[n as Need] ?? n).join(", ");
  if (m[1] === "emp") return `${m[2]} people`;
  if (m[1] === "sites") return `${m[2]} sites`;
  if (m[1] === "gst") return m[2] === "yes" ? "Has GSTIN" : "No GSTIN";
  return m[2];
}
