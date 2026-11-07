import Link from "next/link";
import { Check } from "lucide-react";
import { PageHero, PageShell } from "@/components/SiteNav";
import { SEGMENT_LABELS, type SegmentKey } from "@/lib/catalogue";
import { leadSummary } from "@/lib/analytics";
import { inr } from "@/lib/format";
import { buildQuote } from "@/lib/pricing";
import { recommend } from "@/lib/recommend";
import { PERSONAS, SEGMENT_COPY } from "@/lib/site-content";

export const metadata = { title: "Solutions — Accel Business", description: "The right bundle for every kind of small business: micro retail, professional offices, multi-site chains and small manufacturers." };
// Prices and statistics are computed from the catalogue and lead data at build/request time.

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

export default function SolutionsPage() {
  const summary = leadSummary();
  const keys = Object.keys(SEGMENT_LABELS) as SegmentKey[];
  return (
    <PageShell>
      <PageHero eyebrow="Solutions" title="The right bundle for every kind of small business" sub="Four segments, four very different needs. Each gets a starting bundle, a price point and a journey that fits how they actually buy." />
      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Segments" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col">
            {keys.map((k) => <li key={k} className="shrink-0"><a href={`#${k}`} className="block rounded-xl px-3 py-2 font-semibold text-ink-soft hover:bg-sheet hover:text-ink">{SEGMENT_COPY[k].icon} {SEGMENT_LABELS[k]}</a></li>)}
            <li className="shrink-0"><Link href="/products" className="block rounded-xl px-3 py-2 font-bold text-marigold-deep">All 25 products →</Link></li>
          </ul>
        </nav>

        <div className="space-y-6">
          {keys.map((k) => {
            const c = SEGMENT_COPY[k];
            const st = summary.bySegment.find((s) => s.key === SEGMENT_LABELS[k]);
            const persona = PERSONAS.find((p) => p.id === c.persona)!;
            const rec = recommend({ profile: { ...persona.profile, segment: k } });
            const quote = buildQuote({ lines: rec.lines, currentMonthlySpend: persona.profile.monthlySpend });
            const lines = quote.lines.filter((l) => l.active && !l.blockedReason);
            return (
              <section key={k} id={k} className="card scroll-mt-24 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="text-4xl" aria-hidden>{c.icon}</div><h2 className="mt-1 text-3xl font-extrabold tracking-tight">{SEGMENT_LABELS[k]}</h2><p className="text-ink-soft">{c.who}</p></div>
                  <span className="rounded-full bg-signal/15 px-3 py-1 text-sm font-bold text-signal">{c.share}</span>
                </div>
                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  <div><h3 className="font-bold">What they struggle with</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{c.pain.map((x) => <li key={x}>{x}</li>)}</ul></div>
                  <div><h3 className="font-bold">How SYNC fits</h3><ul className="mt-2 space-y-1.5">{c.plan.map((x) => <li key={x} className="flex gap-2"><Check size={18} className="mt-0.5 shrink-0 text-ok" />{x}</li>)}</ul></div>
                </div>
                {st && (
                  <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[["Activation today", pct(st.activation)], ["Average bundle / month", st.avgBundle ? inr(st.avgBundle) : "—"], ["Acquisition cost", st.cacPerActivation ? inr(st.cacPerActivation) : "—"], ["6-month churn", pct(st.churn)]].map(([l, v]) => (
                      <div key={l} className="rounded-xl border border-rule bg-paper p-3"><dt className="text-xs text-ink-soft">{l}</dt><dd className="mt-0.5 text-xl font-extrabold tabular-nums">{v}</dd></div>
                    ))}
                  </dl>
                )}
                <div className="mt-5 rounded-2xl border border-rule bg-paper p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div><div className="text-xs font-bold tracking-wider text-marigold-deep uppercase">Example: {persona.name}</div><div className="text-sm text-ink-soft">{persona.blurb}</div></div>
                    <div className="text-3xl font-extrabold tabular-nums">{inr(quote.monthlyWithGst)}<span className="text-sm font-semibold text-ink-soft"> /mo incl. GST</span></div>
                  </div>
                  <ul className="mt-3 divide-y divide-rule text-[15px]">{lines.map((l) => <li key={l.productId} className="flex justify-between py-1.5"><span>{l.name} × {l.qty}</span><span className="tabular-nums">{inr(l.monthly)}</span></li>)}</ul>
                  <Link href="/advisor" className="mt-4 inline-block rounded-xl bg-marigold px-5 py-2.5 font-extrabold text-ink">Get a plan like this →</Link>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
