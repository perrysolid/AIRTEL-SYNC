import Link from "next/link";
import { ago, when } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { Score } from "./ui";

/** One lead in a list: who, where, why it scores as it does, and when it was last touched. */
export function LeadCard({ l, showOwner }: { l: Lead; showOwner?: boolean }) {
  const overdue = l.nextAt && Date.parse(l.nextAt) < Date.now();
  return (
    <Link href={`/leads/${l.id}`} className="card flex flex-col gap-2 p-4 transition-colors hover:border-ink/25 sm:flex-row sm:items-center sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-bold">{l.business}</span>
          <span className="text-sm text-ink-soft">{l.type}, {l.city}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          {l.reasons.slice(0, 3).map((r) => (
            <span key={r.label} className={`rounded-full px-2 py-0.5 font-medium ${r.effect > 0 ? "bg-ok/10 text-ok" : "bg-paper text-ink-soft"}`}>{r.effect > 0 ? "▲" : "▼"} {r.label}</span>
          ))}
          {l.dropReason && <span className="rounded-full bg-paper px-2 py-0.5 text-ink-soft">Dropped: {l.dropReason.toLowerCase()}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-right text-xs text-ink-soft">
          <div className={overdue ? "font-bold text-brand" : ""}>{l.nextAt ? `Follow up ${when(l.nextAt)}` : l.lastTouch ? `${l.lastTouch.outcome ?? l.lastTouch.kind}, ${ago(l.lastTouch.at)}` : "Not called yet"}</div>
          <div>{l.statusLabel}{showOwner ? ` · ${l.ownerName}` : ""}</div>
        </div>
        <Score p={l.probability} band={l.band} />
      </div>
    </Link>
  );
}
