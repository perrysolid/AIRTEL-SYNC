"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { logTouch } from "../../../actions";

const OUTCOMES = ["Connected", "No answer", "Busy, call back", "Wrong number", "Not interested"];
const STATUS = [["", "Keep status"], ["contacted", "Contacted"], ["interested", "Interested"], ["quote_sent", "Quote sent"], ["won", "Won"], ["lost", "Lost"], ["dnc", "Do not call"]] as const;

/** Log a call, a WhatsApp link or a note, set the status and book the next follow-up. */
export function LogForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(logTouch, undefined);
  const [kind, setKind] = useState<"call" | "whatsapp" | "note">("call");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setHours(11, 0, 0, 0);
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <form ref={form} action={action} className="space-y-4" id="log">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-paper p-1" role="radiogroup" aria-label="What happened">
        {(["call", "whatsapp", "note"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-lg py-2 text-sm font-semibold transition-colors ${kind === k ? "bg-sheet shadow-[var(--shadow-card)]" : "text-ink-soft"}`}>
            {k === "call" ? "Call" : k === "whatsapp" ? "WhatsApp sent" : "Note"}
          </button>
        ))}
      </div>
      {kind === "call" && (
        <fieldset>
          <legend className="text-sm font-semibold">How did the call go?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <label key={o} className="cursor-pointer">
                <input type="radio" name="outcome" value={o} className="peer sr-only" required />
                <span className="inline-block rounded-full border border-rule bg-sheet px-3.5 py-1.5 text-sm transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-brand">{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Status</span>
          <select name="status" className="mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2.5 text-sm">
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Next follow-up</span>
          <input type="datetime-local" name="nextAt" defaultValue={local(tomorrow)} className="mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-semibold">Notes</span>
        <textarea name="note" rows={3} maxLength={1000} placeholder="What they need, objections, who decides" className="mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2.5 text-sm" />
      </label>
      {state?.error && <p role="alert" className="text-sm font-medium text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok"><CheckCircle2 size={16} /> Saved to the record</p>}
      <button disabled={pending} className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-3">
        {pending && <Loader2 size={16} className="animate-spin" />} Save to record
      </button>
    </form>
  );
}
