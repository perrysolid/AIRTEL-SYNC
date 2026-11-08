import { teamBoard } from "@/lib/sales-data";
import { staffOr401 } from "@/lib/staff-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager and supervisor: each person's week. */
export async function GET() {
  const a = await staffOr401(["admin", "supervisor"]);
  return "res" in a ? a.res : Response.json({ team: await teamBoard() });
}
