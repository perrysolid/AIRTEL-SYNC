import { z } from "zod";
import { CONSENT_VERSION, PURPOSES, type Purpose } from "@/lib/privacy";
import { newId, now, store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  orderId: z.string(),
  purposes: z.record(z.string(), z.boolean()),
});

export async function GET() {
  return Response.json({ version: CONSENT_VERSION, purposes: PURPOSES });
}

/** Records itemised, purpose-specific consent (DPDP s.6) in a hash-chained ledger. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  const o = store.getOrder(body.data.orderId);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const purposes = Object.fromEntries((Object.keys(PURPOSES) as Purpose[]).map((p) => [p, !!body.data.purposes[p]])) as Record<Purpose, boolean>;
  const missing = (Object.keys(PURPOSES) as Purpose[]).filter((p) => PURPOSES[p].required && !purposes[p]);
  if (missing.length) return Response.json({ error: `Consent needed for: ${missing.map((p) => PURPOSES[p].title).join(", ")}` }, { status: 400 });
  const rec = store.addConsent({ id: newId("cns"), orderId: o.id, version: CONSENT_VERSION, purposes, givenAt: now() });
  o.consentId = rec.id;
  store.saveOrder(o);
  store.audit("owner", "consent:given", o.id, Object.entries(purposes).filter(([, v]) => v).map(([k]) => k).join(","));
  return Response.json({ consentId: rec.id, hash: rec.hash });
}
