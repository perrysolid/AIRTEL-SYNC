import { z } from "zod";
import { listStaff, logActivity, teamReports } from "@/lib/crm";
import { staffOr401 } from "@/lib/staff-api";
import { draftReport } from "@/lib/team-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The supervisor's reports to the manager. The supervisor also gets today's draft to edit. */
export async function GET() {
  const a = await staffOr401(["admin", "supervisor"]);
  if ("res" in a) return a.res;
  const names = new Map((await listStaff()).map((s) => [s.id, s.name]));
  return Response.json({
    reports: (await teamReports()).map((r) => ({ id: r.id, at: r.at, by: names.get(r.staffId) ?? r.staffId, text: r.note })),
    draft: a.staff.role === "supervisor" ? await draftReport() : null,
  });
}

const Body = z.object({ text: z.string().trim().min(10, "Write a few lines for the manager.").max(4000) });

/** The supervisor sends the day's report; it appears on the manager's home screen and in the activity feed. */
export async function POST(req: Request) {
  const a = await staffOr401(["supervisor"]);
  if ("res" in a) return a.res;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Check the report." }, { status: 400 });
  const r = await logActivity({ leadId: "team", staffId: a.staff.id, kind: "report", note: body.data.text });
  return Response.json({ ok: true, id: r.id });
}
