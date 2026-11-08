import { cookies } from "next/headers";
import { z } from "zod";
import { customerCookieOptions, CUSTOMER_COOKIE, issueCustomerToken } from "@/lib/auth";
import { signInCustomer } from "@/lib/customers";
import { redeemWhatsAppCode } from "@/lib/otp";
import { WHATSAPP_NUMBER } from "@/lib/winback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The chat link that asks our WhatsApp for a sign-in code. */
export async function GET() {
  return Response.json({ link: `https://wa.me/${WHATSAPP_NUMBER()}?text=LOGIN` });
}

const Body = z.object({ code: z.string().max(8), sessionId: z.string().max(40).optional(), language: z.string().max(5).optional() });

/** Sign in with the code our WhatsApp bot sent in reply to LOGIN. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Enter the code from WhatsApp." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const r = redeemWhatsAppCode(body.data.code.trim(), ip);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  const c = signInCustomer(r.phone, { sessionId: body.data.sessionId, language: body.data.language });
  (await cookies()).set(CUSTOMER_COOKIE, issueCustomerToken(c.id), customerCookieOptions());
  return Response.json({ ok: true, name: c.name ?? null });
}
