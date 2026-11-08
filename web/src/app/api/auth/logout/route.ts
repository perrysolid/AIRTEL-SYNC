import { cookies } from "next/headers";
import { CUSTOMER_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  (await cookies()).delete(CUSTOMER_COOKIE);
  return Response.json({ ok: true });
}
