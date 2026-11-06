import { z } from "zod";
import { lookupGstin, lookupUdyam } from "@/lib/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ gstin: z.string().max(20).optional(), udyam: z.string().max(30).optional() });

/** Mock GSTN / Udyam lookup APIs (backed by the hackathon registries). */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  const out: Record<string, unknown> = {};
  if (body.data.gstin) {
    const g = lookupGstin(body.data.gstin);
    out.gstin = {
      input: body.data.gstin,
      normalized: g.gstin,
      formatOk: g.check.formatOk,
      checksumOk: g.check.checksumOk,
      state: g.check.state,
      error: g.check.error,
      found: g.found,
      record: g.record && { legalName: g.record.legal_name, tradeName: g.record.trade_name, constitution: g.record.constitution, status: g.record.status, state: g.record.state, registeredOn: g.record.registration_date, address: g.record.principal_place_of_business },
    };
  }
  if (body.data.udyam) {
    const u = lookupUdyam(body.data.udyam);
    out.udyam = {
      normalized: u.udyam,
      formatOk: u.check.formatOk,
      error: u.check.error,
      found: u.found,
      record: u.record && { name: u.record.enterprise_name, type: u.record.enterprise_type, activity: u.record.major_activity, nic: u.record.nic_description, city: u.record.city, state: u.record.state, registeredOn: u.record.date_of_registration },
    };
  }
  return Response.json(out);
}
