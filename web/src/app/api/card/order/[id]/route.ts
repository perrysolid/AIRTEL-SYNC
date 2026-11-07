import { orderCard } from "@/lib/cards";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status card WhatsApp/Telegram fetch for each order update (no personal data on it). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = store.getOrder((await params).id);
  return o ? orderCard(o) : new Response("Not found", { status: 404 });
}
