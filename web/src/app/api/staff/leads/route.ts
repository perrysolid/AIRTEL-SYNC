import { listStaff, OPEN_STATUSES, visibleLeads } from "@/lib/crm";
import { leadRow, staffOr401 } from "@/lib/staff-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The lead book, best chance to activate first. ?book=registered|winback; ?q= searches name, city and id; ?status=open|<status>; ?band=hot|warm|cold; ?owner=. */
export async function GET(req: Request) {
  const a = await staffOr401();
  if ("res" in a) return a.res;
  const u = new URL(req.url).searchParams;
  const q = (u.get("q") ?? "").trim().toLowerCase();
  const status = u.get("status") ?? "open";
  const band = u.get("band");
  const owner = u.get("owner");
  const book = u.get("book") === "winback" ? "winback" : "registered";
  const limit = Math.min(200, Number(u.get("limit") ?? 60));
  const names = new Map((await listStaff()).map((s) => [s.id, s.name]));
  const all = (await visibleLeads(a.staff, book))
    .filter((l) => (status === "all" ? true : status === "open" ? OPEN_STATUSES.includes(l.status) : l.status === status))
    .filter((l) => !band || l.score.band === band)
    .filter((l) => !owner || l.owner === owner)
    .filter((l) => !q || `${l.id} ${l.row.business_name} ${l.row.city} ${l.row.business_type}`.toLowerCase().includes(q))
    .sort((x, y) => y.score.probability - x.score.probability);
  return Response.json({ total: all.length, leads: all.slice(0, limit).map((l) => leadRow(l, names)) });
}
