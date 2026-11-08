import { telegramLinkCode } from "@/lib/auth";
import { currentCustomer } from "@/lib/customer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A one-time t.me link that connects this account to the owner's Telegram chat. */
export async function GET() {
  const c = await currentCustomer();
  if (!c) return Response.json({ error: "Sign in first." }, { status: 401 });
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "UdyamAdvisorBot";
  return Response.json({ url: `https://t.me/${bot}?start=l_${telegramLinkCode(c.id)}` });
}
