import { welcomeCard } from "@/lib/cards";

export const runtime = "nodejs";

/** Welcome card sent when someone first says hi on WhatsApp or Telegram. */
export function GET() {
  const res = welcomeCard();
  res.headers.set("Cache-Control", "public, max-age=3600");
  return res;
}
