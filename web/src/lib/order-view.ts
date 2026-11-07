import { maskGstin, maskPhone, maskUdyam, maskName, maskId } from "./privacy";
import { liveDay } from "./tracker";
import type { Order } from "./store";

/** What the owner's browser gets: identifiers masked, no raw KYC fields. */
export function publicOrder(o: Order) {
  const steps = [
    { key: "order", label: "Order placed", done: true },
    { key: "kyc", label: "Business verified", done: o.kyc?.result.verdict === "verified" },
    { key: "esign", label: "Agreement e-signed", done: !!o.esign },
    { key: "payment", label: "First payment", done: !!o.payment },
    { key: "live", label: "All services live", done: o.timeline.clockDay >= 0 && o.timeline.clockDay >= liveDay(o.timeline) },
  ];
  return {
    id: o.id,
    createdAt: o.createdAt,
    businessName: o.businessName,
    city: o.city,
    contactName: o.contactName,
    phone: maskPhone(o.phone),
    gstin: maskGstin(o.profile.gstin),
    udyam: maskUdyam(o.profile.udyam),
    lines: o.lines,
    term: o.term,
    quote: o.quote,
    consentId: o.consentId,
    kyc: o.kyc && {
      verdict: o.kyc.result.verdict,
      summary: o.kyc.result.summary,
      checks: o.kyc.result.checks,
      actions: o.kyc.result.actions,
      at: o.kyc.at,
      docs: o.kyc.docs.map((d) => ({
        docType: d.docType,
        engine: d.engine,
        sha256: d.sha256.slice(0, 12),
        // Show only masked identifiers back to the browser.
        fields: Object.fromEntries(
          Object.entries(d.fields).map(([k, v]) => [
            k,
            !v ? v : k === "gstin" ? maskGstin(v) : k === "udyamNumber" ? maskUdyam(v) : k === "signatoryName" ? maskName(v) : k === "idNumber" || k === "consumerNumber" ? maskId(v) : v,
          ]),
        ),
      })),
    },
    esign: o.esign,
    payment: o.payment,
    timeline: o.timeline,
    liveDay: liveDay(o.timeline),
    steps,
    notifications: o.notifications,
    pincode: o.pincode,
    slot: o.slot,
    reschedules: o.reschedules ?? 0,
    outageActive: !!o.outageActive,
    incidents: o.incidents ?? [],
    tickets: o.tickets ?? [],
    hasFailover: o.lines.some((l) => l.productId === "P09"),
    parentId: o.parentId,
    branches: o.branches ?? [],
    pendingDocs: o.pendingDocs ?? [],
    segment: o.profile.segment,
    sites: o.profile.sites ?? 1,
  };
}
export type PublicOrder = ReturnType<typeof publicOrder>;
