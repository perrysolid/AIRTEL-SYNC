import { z } from "zod";
import { POST as ownerAction } from "@/app/api/order/[id]/action/route";
import { notifyOrder } from "@/lib/notify";
import { publicOrder } from "@/lib/order-view";
import { ordersFor } from "@/lib/sales-data";
import { orderRow, reachFor, staffOr401 } from "@/lib/staff-api";
import { store } from "@/lib/store";
import { liveDay, stepStatus } from "@/lib/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(id: string) {
  const a = await staffOr401();
  if ("res" in a) return a;
  const o = (await ordersFor(a.staff)).find((x) => x.id === id);
  if (!o) return { res: Response.json({ error: "This order isn't in your book." }, { status: 404 }) };
  return { staff: a.staff, o };
}

function detail(id: string) {
  const o = store.getOrder(id)!;
  const v = publicOrder(o);
  return {
    ...orderRow(o),
    steps: v.steps,
    lines: o.lines.map((l) => ({ name: l.name, qty: l.qty, monthly: l.monthly })),
    kyc: v.kyc ? { verdict: v.kyc.verdict, summary: v.kyc.summary, issues: v.kyc.checks?.filter((c) => c.status === "fail").map((c) => c.title) ?? [] } : null,
    tracks: o.timeline.tracks.map((t) => ({ key: t.key, title: t.title, steps: t.steps.map((s) => ({ label: s.label, day: s.dueDay, status: o.payment ? stepStatus(s, o.timeline.clockDay) : "upcoming" })) })),
    clockDay: o.timeline.clockDay,
    liveDay: liveDay(o.timeline),
    activating: !!o.payment && o.timeline.clockDay < liveDay(o.timeline),
    hasFibre: o.lines.some((l) => ["P01", "P02", "P03"].includes(l.productId)),
    updates: [...o.notifications].reverse(),
    reach: reachFor(o),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const l = await load((await params).id);
  return "res" in l ? l.res : Response.json(detail(l.o.id));
}

const Body = z.discriminatedUnion("action", [
  /** Field team finished the next day of installation work: moves every track on and tells the owner what went live. */
  z.object({ action: z.literal("next_day") }),
  /** Survey found no fibre at the address: switch to 5G AirFiber and tell the owner. */
  z.object({ action: z.literal("fibre_not_feasible") }),
  /** A message in the staff member's own words, sent to the owner on every channel they use. */
  z.object({ action: z.literal("message"), text: z.string().trim().min(3).max(600) }),
]);

/** Staff updates an order. Every update reaches the owner automatically: tracker, WhatsApp, Telegram. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const l = await load(id);
  if ("res" in l) return l.res;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Write a message of at least a few words." }, { status: 400 });
  if (body.data.action === "message") {
    notifyOrder(l.o, `📣 ${body.data.text}\n— ${l.staff.name.split(" ")[0]}, Accel Business`);
    store.saveOrder(l.o);
  } else {
    // Same rules as the owner's own tracker actions.
    const r = await ownerAction(new Request(req.url, { method: "POST", body: JSON.stringify({ action: body.data.action }) }), { params: Promise.resolve({ id }) });
    if (!r.ok) return Response.json(await r.json(), { status: r.status });
  }
  store.audit(l.staff.id, `staff:order:${body.data.action}`, id);
  return Response.json(detail(id));
}
