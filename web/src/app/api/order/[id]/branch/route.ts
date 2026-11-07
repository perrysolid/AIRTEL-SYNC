import { z } from "zod";
import { createBranch, previewBranch } from "@/lib/branch";
import { publicOrder } from "@/lib/order-view";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  city: z.string().trim().min(2).max(40),
  pincode: z.string().max(12),
  staff: z.number().int().min(1).max(5000).optional(),
  confirm: z.boolean().default(false),
});

/** Branch-in-a-Box. `confirm:false` returns a preview (price, network result, what is reused); `confirm:true` creates the branch order. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parent = store.getOrder((await params).id);
  if (!parent) return Response.json({ error: "Order not found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  if (!parent.payment) return Response.json({ error: "Finish your first order before adding a branch." }, { status: 409 });
  const { confirm, ...input } = body.data;
  if (!confirm) {
    const r = previewBranch(parent, input);
    return r.ok ? Response.json(r.preview) : Response.json({ error: r.error }, { status: 422 });
  }
  const r = createBranch(parent, input);
  if (!r.ok) return Response.json({ error: r.error }, { status: 422 });
  return Response.json({ preview: r.preview, order: publicOrder(r.order) });
}
