import { cookies } from "next/headers";
import { cookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { authenticate } from "@/lib/staff-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST {email, password} signs a staff member in. DELETE signs out. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const r = await authenticate(String(body.email ?? ""), String(body.password ?? ""), ip);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  (await cookies()).set(SESSION_COOKIE, r.token, cookieOptions());
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
