import { staffOr401 } from "@/lib/staff-api";
import { teamFeed } from "@/lib/team-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What happened across the business in the last week, newest first. ?limit= caps it (default 120). */
export async function GET(req: Request) {
  const a = await staffOr401();
  if ("res" in a) return a.res;
  const limit = Math.min(300, Number(new URL(req.url).searchParams.get("limit") ?? 120));
  return Response.json({ events: await teamFeed(a.staff, 7, limit) });
}
