import { z } from "zod";
import { leadViews, logActivity, staffById } from "@/lib/crm";
import { staffOr401 } from "@/lib/staff-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ to: z.string().max(40) });

/** Managers move a lead to another salesperson or channel partner. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await staffOr401(["admin"]);
  if ("res" in a) return a.res;
  const id = (await params).id;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  const to = body.success ? await staffById(body.data.to) : undefined;
  if (!to || to.role === "admin") return Response.json({ error: "Pick a salesperson or partner." }, { status: 400 });
  if (!(await leadViews()).has(id)) return Response.json({ error: "Lead not found." }, { status: 404 });
  await logActivity({ leadId: id, staffId: a.staff.id, kind: "assign", note: to.id });
  return Response.json({ ok: true });
}
