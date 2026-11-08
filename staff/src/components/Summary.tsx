import type { ChatSummary } from "@/lib/types";

/** What happened in an advisor conversation, laid out for whoever follows up. */
export function Summary({ s, compact }: { s: ChatSummary; compact?: boolean }) {
  return (
    <div className="text-sm">
      <p className="text-[15px]">{s.headline}</p>
      {!compact && (
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          {s.needs.length > 0 && <><dt className="text-ink-soft">Wants</dt><dd>{s.needs.join(", ")}</dd></>}
          {s.offered && <><dt className="text-ink-soft">We offered</dt><dd>{s.offered}</dd></>}
          {s.concerns.length > 0 && <><dt className="text-ink-soft">Concerns</dt><dd>{s.concerns.join("; ")}</dd></>}
          <dt className="text-ink-soft">Outcome</dt><dd>{s.outcome}</dd>
        </dl>
      )}
      <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 font-semibold text-brand-deep">Next: {s.nextStep}</p>
    </div>
  );
}
