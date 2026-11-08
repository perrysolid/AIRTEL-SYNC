import { cookies } from "next/headers";
import { z } from "zod";
import { customerCookieOptions, CUSTOMER_COOKIE, issueCustomerToken } from "@/lib/auth";
import { signInCustomer } from "@/lib/customers";
import { verifyOtp } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  requestId: z.string().max(64),
  code: z.string().max(8),
  name: z.string().max(60).optional(),
  /** The advisor conversation on this device, so what they already said is remembered. */
  sessionId: z.string().max(40).optional(),
  language: z.string().max(5).optional(),
});

/** Step 2 of sign-in: check the code, create or load the account, set a 30-day cookie. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Enter the code from the SMS." }, { status: 400 });
  const r = await verifyOtp(body.data.requestId, body.data.code.trim());
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  const c = signInCustomer(r.phone, { name: body.data.name, sessionId: body.data.sessionId, language: body.data.language });
  (await cookies()).set(CUSTOMER_COOKIE, issueCustomerToken(c.id), customerCookieOptions());
  return Response.json({ ok: true, name: c.name ?? null, isNew: c.sessionIds.length === 0 && c.orderIds.length === 0 });
}
