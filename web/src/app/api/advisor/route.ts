import { z } from "zod";
import { advisorTurn } from "@/lib/advisor";
import type { AdvisorEvent } from "@/lib/advisor-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.string().optional(),
  message: z.string().max(2000).default(""),
  channel: z.enum(["web", "voice", "whatsapp", "partner"]).default("web"),
  language: z.string().max(5).default("en"),
  forceGuided: z.boolean().optional(),
});

/** Streams advisor events as Server-Sent Events. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AdvisorEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await advisorTurn(parsed.data, emit);
      } catch (err) {
        console.error("[api/advisor]", err);
        emit({ type: "error", message: "Something went wrong. Please try again." });
        emit({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
