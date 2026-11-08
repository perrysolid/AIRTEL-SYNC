import Link from "next/link";
import { Flame } from "lucide-react";
import { STATUSES, type LeadStatus, type LeadView } from "@/lib/crm";

/** Shared building blocks for the sales portal pages (server-safe). */

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1.5 text-ink-soft">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="text-lg font-bold" style={{ fontVariationSettings: '"wdth" 104', letterSpacing: "-0.01em", lineHeight: 1.2 }}>{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? "night" : "card"}`}>
      <div className={`text-sm ${accent ? "text-white/70" : "text-ink-soft"}`}>{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums" style={{ fontVariationSettings: '"wdth" 110' }}>{value}</div>
      {note && <div className={`mt-1 text-sm ${accent ? "text-white/60" : "text-ink-soft"}`}>{note}</div>}
    </div>
  );
}

export function ScoreBadge({ p, band }: { p: number; band: "hot" | "warm" | "cold" }) {
  const cls = band === "hot" ? "bg-brand/10 text-brand" : band === "warm" ? "bg-marigold/15 text-marigold-deep" : "bg-paper text-ink-soft";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${cls}`} title="Chance to activate, from the propensity model">
      {band === "hot" && <Flame size={13} />}
      {Math.round(p * 100)}%
    </span>
  );
}

const STATUS_CLS: Record<LeadStatus, string> = {
  to_call: "bg-paper text-ink",
  contacted: "bg-[#2a78d6]/10 text-[#1d5fae]",
  interested: "bg-[#1baf7a]/12 text-[#0f7a55]",
  quote_sent: "bg-marigold/15 text-marigold-deep",
  won: "bg-ok/12 text-ok",
  lost: "bg-paper text-ink-soft line-through",
  dnc: "bg-bad/10 text-bad",
  customer: "bg-ok/12 text-ok",
};
export function StatusBadge({ s }: { s: LeadStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_CLS[s]}`}>{STATUSES[s]}</span>;
}

const rel = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
export function when(iso: string, now = Date.now()) {
  const d = (new Date(iso).getTime() - now) / 86_400_000;
  if (Math.abs(d) < 1 / 24) return rel.format(Math.round(d * 24 * 60), "minute");
  if (Math.abs(d) < 1) return rel.format(Math.round(d * 24), "hour");
  return rel.format(Math.round(d), "day");
}

export function LeadLine({ l, showOwner }: { l: LeadView; showOwner?: string }) {
  return (
    <Link href={`/sales/leads/${l.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper sm:grid-cols-[minmax(0,1fr)_9rem_6rem]">
      <div className="min-w-0">
        <div className="truncate font-semibold">{l.row.business_name}</div>
        <div className="truncate text-sm text-ink-soft">
          {l.row.business_type}, {l.row.city}{showOwner ? `, ${showOwner}` : ""}
        </div>
        <div className="mt-1 truncate text-xs text-ink-soft">{l.score.reasons.map((r) => r.label).join(", ")}</div>
      </div>
      <div className="hidden text-sm sm:block">
        <StatusBadge s={l.status} />
        {l.nextAt && <div className={`mt-1 text-xs ${new Date(l.nextAt).getTime() < Date.now() ? "font-semibold text-bad" : "text-ink-soft"}`}>Follow up {when(l.nextAt)}</div>}
      </div>
      <div className="text-right"><ScoreBadge p={l.score.probability} band={l.score.band} /></div>
    </Link>
  );
}
