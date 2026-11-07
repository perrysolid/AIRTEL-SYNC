"use client";

import { useState } from "react";
import { CheckCircle2, Circle, CircleDot, FastForward, RadioTower } from "lucide-react";
import type { PublicOrder } from "@/lib/order-view";
import { act } from "./SignPay";
import { Shop3D } from "@/components/shop/Shop3D";
import { BranchPanel, HealthPanel, SlotPanel } from "./Extras";

const TABS = [["progress", "Progress"], ["slot", "Install slot"], ["health", "Health & backup"], ["branch", "New branch"]] as const;
type Tab = (typeof TABS)[number][0];

function status(dueDay: number, doneAtDay: number | undefined, clock: number) {
  if (doneAtDay !== undefined || dueDay <= clock) return "done";
  if (dueDay === clock + 1) return "active";
  return "upcoming";
}

/** Staged activation tracker: each service track moves on its own clock. */
export function Tracker({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const t = order.timeline;
  const [busy, setBusy] = useState(false);
  // ?tab=slot|health|branch deep-links straight to a panel (the tracker only renders client-side, so reading the URL here is safe)
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab");
    return TABS.some(([k]) => k === t) ? (t as Tab) : "progress";
  });
  const allLive = t.clockDay >= order.liveDay;
  const live = t.tracks.filter((tr) => tr.steps.every((s) => status(s.dueDay, s.doneAtDay, t.clockDay) === "done")).flatMap((tr) => tr.productIds);
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
      <div role="tablist" aria-label="Order sections" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${tab === k ? "border-ink bg-ink text-white" : "border-rule bg-sheet text-ink-soft"}`}>{label}</button>
        ))}
      </div>
      {tab === "slot" && <SlotPanel order={order} onUpdate={onUpdate} />}
      {tab === "health" && <HealthPanel order={order} onUpdate={onUpdate} />}
      {tab === "branch" && <BranchPanel order={order} onUpdate={onUpdate} />}
      {tab === "progress" && (<>
      {!order.slot && order.timeline.tracks.some((x) => x.key === "internet") && (
        <button onClick={() => setTab("slot")} className="mb-4 flex w-full items-center gap-2 rounded-xl border border-marigold-deep bg-marigold/15 p-3 text-left font-semibold">📅 Pick your installation slot <span className="ml-auto text-sm font-bold underline">Choose a time →</span></button>
      )}
      <h2 className="text-2xl font-extrabold">{allLive ? "Everything is live" : `Day ${t.clockDay} of ${order.liveDay}`}</h2>
      <div className="card relative mt-4 h-64 overflow-hidden sm:h-72">
        <Shop3D items={order.lines.map((l) => l.productId)} live={live} className="absolute inset-0" />
        <div className="absolute top-3 left-3 flex gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sheet/90 px-2.5 py-1 backdrop-blur"><span className="h-2 w-2 rounded-full bg-signal" /> Live</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sheet/90 px-2.5 py-1 backdrop-blur"><span className="h-2 w-2 rounded-full bg-marigold" /> Setting up</span>
        </div>
      </div>
      <p className="mt-3 text-ink-soft">{allLive ? "One bill, one support number. Reply HELP on WhatsApp any time." : "Each service switches on as soon as it's ready — you don't have to wait for all of them."}</p>

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
          <button disabled={busy || allLive} onClick={() => run("next_day")} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
            <FastForward size={15} /> Next day
          </button>
          <button disabled={busy || !t.tracks.some((x) => x.productIds.some((id) => ["P01", "P02", "P03"].includes(id)))} onClick={() => run("fibre_not_feasible")} className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sheet px-3 py-2 text-sm font-semibold disabled:opacity-40">
            <RadioTower size={15} /> Fibre not feasible here
          </button>
        </div>
      </div>
      </>)}
    </section>
  );
}
