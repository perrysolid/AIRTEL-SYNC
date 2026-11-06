import { store } from "@/lib/store";
import { aiEnabled } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = store.getSession((await params).id);
  if (!s) return Response.json({ error: "Not found" }, { status: 404 });
  // The raw model transcript stays server-side.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { messages, ...pub } = s;
  return Response.json({ ...pub, aiEnabled: aiEnabled() });
}
