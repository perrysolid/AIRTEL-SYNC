import { z } from "zod";
import { maskPhone, normalizePhone } from "@/lib/customers";
import { sendOtp } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ phone: z.string().max(20), via: z.enum(["sms", "call"]).default("sms") });

/** Step 1 of sign-in: text a one-time code to the owner's mobile, or call them and read it out. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  const phone = body.success ? normalizePhone(body.data.phone) : undefined;
  if (!phone) return Response.json({ error: "Enter a 10-digit Indian mobile number." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const r = await sendOtp(phone, ip, Date.now(), body.success ? body.data.via : "sms");
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ requestId: r.requestId, sentTo: maskPhone(phone) });
}
