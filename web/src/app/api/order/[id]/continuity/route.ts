import { continuity } from "@/lib/continuity";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: string | null, d: number, min: number, max: number) => {
  const n = Number(v);
  return v !== null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Service-health snapshot plus the "is a backup link worth it" estimate (inputs are the owner's own). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  const q = new URL(req.url).searchParams;
  return Response.json(
    continuity(o, {
      salesPerHour: q.has("sales_per_hour") ? num(q.get("sales_per_hour"), 500, 0, 1_000_000) : undefined,
      dependentPct: num(q.get("dependent_pct"), 60, 0, 100),
      hours: num(q.get("hours"), 4, 0, 200),
    }),
  );
}
