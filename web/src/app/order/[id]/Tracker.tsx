"use client";

import { useState } from "react";
import { CheckCircle2, Circle, CircleDot, FastForward, RadioTower } from "lucide-react";
import type { PublicOrder } from "@/lib/order-view";
import { act } from "./SignPay";

function status(dueDay: number, doneAtDay: number | undefined, clock: number) {
  if (doneAtDay !== undefined || dueDay <= clock) return "done";
  if (dueDay === clock + 1) return "active";
  return "upcoming";
}

/** Staged activation tracker: each service track moves on its own clock. */
export function Tracker({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const t = order.timeline;
  const [busy, setBusy] = useState(false);
  const allLive = t.clockDay >= order.liveDay;
  const run = async (action: string) => {
    setBusy(true);
    try {
      onUpdate(await act(order.id, { action }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-extrabold">{allLive ? "Everything is live" : `Day ${t.clockDay} of ${order.liveDay}`}</h2>
      <p className="mt-1 text-ink-soft">{allLive ? "One bill, one support number. Reply HELP on WhatsApp any time." : "Each service switches on as soon as it's ready — you don't have to wait for all of them."}</p>

      <div className="mt-4 space-y-3">
        {t.tracks.map((tr) => {
          const done = tr.steps.every((s) => status(s.dueDay, s.doneAtDay, t.clockDay) === "done");
          return (
            <div key={tr.key} className={`rounded-xl border bg-sheet p-4 ${done ? "border-ok/40" : "border-rule"}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{tr.title}</h3>
                <span className={`text-sm font-semibold ${done ? "text-ok" : "text-ink-soft"}`}>{done ? "Live" : `by day ${Math.max(...tr.steps.map((s) => s.dueDay))}`}</span>
              </div>
              <ol className="mt-3 space-y-2">
                {tr.steps.map((s) => {
                  const st = status(s.dueDay, s.doneAtDay, t.clockDay);
                  return (
                    <li key={s.key} className="flex items-start gap-2.5 text-[15px]">
                      {st === "done" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> : st === "active" ? <CircleDot size={18} className="mt-0.5 shrink-0 text-marigold-deep" /> : <Circle size={18} className="mt-0.5 shrink-0 text-rule" />}
                      <span className={st === "upcoming" ? "text-ink-soft" : ""}>{s.label}</span>
                      <span className="ml-auto shrink-0 text-sm text-ink-soft">day {s.dueDay}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-rule p-3">
        <div className="text-sm font-semibold text-ink-soft">Demo controls</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button disabled={busy || allLive} onClick={() => run("next_day")} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-40">
            <FastForward size={15} /> Next day
          </button>
          <button disabled={busy || !t.tracks.some((x) => x.productIds.some((id) => ["P01", "P02", "P03"].includes(id)))} onClick={() => run("fibre_not_feasible")} className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sheet px-3 py-2 text-sm font-semibold disabled:opacity-40">
            <RadioTower size={15} /> Fibre not feasible here
          </button>
        </div>
      </div>
    </section>
  );
}
