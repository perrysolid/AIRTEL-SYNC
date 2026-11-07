import { z } from "zod";
import { checkNetwork } from "@/lib/network";
import { store } from "@/lib/store";
import { applyNetworkToSession } from "@/lib/network-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ pincode: z.string().max(12), city: z.string().max(60).optional(), sessionId: z.string().optional() });

/**
 * Network Reality Check. With a sessionId it also records the pincode on the quote and, when fibre isn't
 * available, re-runs the recommendation on 5G AirFiber so the owner never buys a line that can't be installed.
 */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const s = body.data.sessionId ? store.getSession(body.data.sessionId) : undefined;
  const result = checkNetwork(body.data.pincode, body.data.city ?? s?.profile.city);
  if (!result.ok) return Response.json(result, { status: 422 });
  if (!s) return Response.json(result);

  const changed = applyNetworkToSession(s, result);
  store.saveSession(s);
  return Response.json({ ...result, changed, quote: changed ? s.quote : undefined, recommendation: changed ? s.recommendation : undefined });
}
