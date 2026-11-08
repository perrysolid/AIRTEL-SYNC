import { quoteCard } from "@/lib/cards";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Plan card sent in chat when the advisor builds a quote. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = store.getSession((await params).id);
  return s?.quote ? quoteCard(s) : new Response("Not found", { status: 404 });
}
