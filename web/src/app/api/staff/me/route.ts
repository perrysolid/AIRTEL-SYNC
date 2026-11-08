import { staffOr401 } from "@/lib/staff-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await staffOr401();
  return "res" in a ? a.res : Response.json(a.staff);
}
