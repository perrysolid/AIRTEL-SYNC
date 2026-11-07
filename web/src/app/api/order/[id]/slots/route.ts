import { slotsFor } from "@/lib/scheduler";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json(slotsFor(o));
}
