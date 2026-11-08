"use client";

import { useState } from "react";
import { ago, inr, send, useApi } from "@/lib/api";
import { Empty, LiveDot, Loading, PageHead, TelegramLogo, WhatsAppLogo } from "@/components/ui";

interface Chat {
  id: string;
  status: string;
  channel: string;
  language: string;
  updatedAt: string;
  business: string;
  city: string | null;
  summary: string;
  reason: string;
  lastMessage: string | null;
  monthlyWithGst: number | null;
  canNudge: boolean;
}

const CHANNEL: Record<string, React.ReactNode> = { whatsapp: <WhatsAppLogo />, telegram: <TelegramLogo /> };

/** Conversations the advisor could not close, newest first: the stretch goal's back-office view. */
export default function Chats() {
  const { data, reload } = useApi<{ chats: Chat[] }>("/api/staff/advisor", 10_000);
  return (
    <>
      <PageHead title="Advisor chats to pick up" sub="Owners who asked for a person, got a plan but didn't order, or went quiet." right={<LiveDot />} />
      {!data ? <Loading /> : data.chats.length ? <div className="grid gap-3">{data.chats.map((c) => <ChatCard key={c.id} c={c} onDone={reload} />)}</div> : <Empty>Every conversation closed itself. Nothing to pick up.</Empty>}
    </>
  );
}

function ChatCard({ c, onDone }: { c: Chat; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | string>("idle");
  const urgent = c.status === "handoff";
  return (
    <article className={`card p-5 ${urgent ? "border-brand/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {CHANNEL[c.channel] ?? <span className="rounded bg-paper px-1.5 text-xs font-bold text-ink-soft">Web</span>}
            <span className="font-bold">{c.business}</span>
            {c.city && <span className="text-sm text-ink-soft">{c.city}</span>}
          </div>
          <div className={`mt-1 text-sm font-semibold ${urgent ? "text-brand" : "text-ink-soft"}`}>{c.reason} · {ago(c.updatedAt)}</div>
        </div>
        {c.monthlyWithGst && <div className="text-right"><div className="tabular text-lg font-extrabold">{inr(c.monthlyWithGst)}</div><div className="text-xs text-ink-soft">a month, plan shown</div></div>}
      </div>
      <p className="mt-3 text-sm">{c.summary}</p>
      {c.lastMessage && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm text-ink-soft">“{c.lastMessage}”</p>}
      {c.canNudge && (
        <div className="mt-3 flex items-center gap-3">
          <button
            disabled={state === "busy" || state === "sent"}
            onClick={async () => {
              setState("busy");
              const r = await send("/api/console/nudge", "POST", { sessionId: c.id });
              setState(r.ok ? "sent" : r.error);
              if (r.ok) onDone();
            }}
            className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {state === "sent" ? "Reminder sent" : "Send a reminder in their chat"}
          </button>
          {state !== "idle" && state !== "busy" && state !== "sent" && <span className="text-sm text-brand">{state}</span>}
        </div>
      )}
    </article>
  );
}
