import { waLinkStatus } from "@/lib/bots/wa-link";

export const dynamic = "force-dynamic";

/**
 * For an uptime monitor (UptimeRobot, cron-job.org): 200 while the WhatsApp number is linked, 503 otherwise, so
 * the monitor emails someone. Separate from /api/health, which Render uses to decide whether to restart the server.
 */
export function GET() {
  const s = waLinkStatus();
  return Response.json({ whatsapp: s.state, since: s.since }, { status: s.state === "open" ? 200 : 503 });
}
