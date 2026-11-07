import { runNudges } from "@/lib/nudges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends due stall reminders. The backend also runs this every 5 minutes on its
 * own; an uptime pinger hitting this URL keeps a free Render instance awake
 * too. With CRON_SECRET set, callers must send it as a Bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const sent = await runNudges();
  return Response.json({ ok: true, sent: sent.length });
}
