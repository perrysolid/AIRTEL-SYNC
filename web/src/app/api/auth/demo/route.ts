import { cookies } from "next/headers";
import { z } from "zod";
import { customerCookieOptions, CUSTOMER_COOKIE, issueCustomerToken } from "@/lib/auth";
import { startDemoCustomer } from "@/lib/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ sessionId: z.string().max(40).optional() });

/** "Continue with demo": signs in to a fresh demo account without a phone number. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  const c = startDemoCustomer(body.success ? body.data.sessionId : undefined);
  (await cookies()).set(CUSTOMER_COOKIE, issueCustomerToken(c.id), customerCookieOptions());
  return Response.json({ ok: true, name: c.name });
}
