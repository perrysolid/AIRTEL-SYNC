import { z } from "zod";
import { staffOr401 } from "@/lib/staff-api";
import { pairWaLink, unlinkWaLink, waLinkEnabled, waLinkStatus } from "@/lib/bots/wa-link";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin: the WhatsApp number the bot runs on (linked device). */
export async function GET() {
  const a = await staffOr401(["admin"]);
  if ("res" in a) return a.res;
  return Response.json({ enabled: waLinkEnabled(), ...waLinkStatus() });
}

const Body = z.union([z.object({ number: z.string().regex(/^\+?[\d\s-]{10,16}$/, "Enter the number with country code, e.g. 91 98765 43210") }), z.object({ action: z.literal("unlink") })]);

export async function POST(req: Request) {
  const a = await staffOr401(["admin"]);
  if ("res" in a) return a.res;
  if (!waLinkEnabled()) return Response.json({ error: "Set WA_LINK=on on the backend first" }, { status: 409 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  store.audit(a.staff.id, "action" in body.data ? "whatsapp:unlink" : "whatsapp:pair", "wa-link", "");
  const status = "action" in body.data ? await unlinkWaLink() : await pairWaLink(body.data.number);
  return Response.json({ enabled: true, ...status });
}
