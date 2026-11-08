import { teamBoard } from "@/lib/sales-data";
import { staffOr401 } from "@/lib/staff-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Managers: each salesperson's and partner's week. */
export async function GET() {
  const a = await staffOr401(["admin"]);
  return "res" in a ? a.res : Response.json({ team: await teamBoard() });
}
