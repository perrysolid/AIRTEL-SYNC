import { aiProviders } from "@/lib/ai";
import { telegramEnabled } from "@/lib/bots/telegram";
import { whatsappCloudEnabled } from "@/lib/bots/whatsapp-cloud";
import { waLinkEnabled, waLinkStatus } from "@/lib/bots/wa-link";

/** Render health check; also shows which integrations are configured (never their values). */
export function GET() {
  return Response.json({ ok: true, ai: aiProviders(), telegram: telegramEnabled(), whatsapp: whatsappCloudEnabled(), whatsappLink: waLinkEnabled() ? waLinkStatus().state : "off" });
}
