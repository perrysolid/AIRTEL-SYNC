"use client";

import { inr, pct, useApi } from "@/lib/api";
import { Kpi, Loading, PageHead } from "@/components/ui";

interface Insights {
  baseline: {
    funnel: { stage: string; count: number }[];
    activationRate: number;
    avgDaysToActivate: number;
    avgChaseCalls: number;
    cacPerActivation: number;
    churn6m: number;
    dropReasons: { stage: string; reason: string; count: number }[];
    bySource: { key: string; leads: number; activation: number; cacPerActivation: number | null }[];
    model: { auc: number; lift: number };
  };
  targets: { metric: string; today: string; target: string }[];
  digital: { conversations: number; quoted: number; orders: number; live: number; avgPlannedDays: number | null; updatesPerOrder: number | null };
}

/** The baseline the case set out to move (last quarter, smb_leads.csv), the targets, and the digital journey so far. */
export default function InsightsPage() {
  const { data } = useApi<Insights>("/api/staff/insights", 60_000);
  if (!data) return <><PageHead title="Insights" /><Loading /></>;
  const q = data.baseline;
  const d = data.digital;
  return (
    <>
      <PageHead title="Insights" sub="What we measure, where we started and where we're going." />
      <section>
        <h2 className="text-xl font-extrabold">The four numbers we are moving</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-soft"><tr><th className="px-4 py-3 font-medium">Metric</th><th className="px-4 py-3 font-medium">Last quarter</th><th className="px-4 py-3 font-medium">Target</th></tr></thead>
            <tbody>{data.targets.map((t) => <tr key={t.metric} className="border-t border-rule"><td className="px-4 py-3 font-semibold">{t.metric}</td><td className="tabular px-4 py-3">{t.today}</td><td className="px-4 py-3 font-bold text-ok">{t.target}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">The digital journey so far</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Advisor conversations" value={d.conversations} sub={`${d.quoted} got a priced plan`} />
          <Kpi label="Orders" value={d.orders} sub={d.quoted ? `${pct(d.orders / d.quoted)} of priced plans` : "None yet"} />
          <Kpi label="Fully live" value={d.live} sub={d.avgPlannedDays !== null ? `${d.avgPlannedDays.toFixed(1)} days planned on average` : "None yet"} />
          <Kpi label="Updates per order" value={d.updatesPerOrder !== null ? d.updatesPerOrder.toFixed(1) : "–"} sub="Sent to the owner, so they don't have to call" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold">Last quarter, before digital</h2>
        <p className="text-ink-soft">5,000 leads from April to June 2026 (smb_leads.csv).</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="card p-5">
              <div className="font-bold">Lead to activation</div>
              <ol className="mt-4 grid gap-2.5">
                {q.funnel.map((s, i) => {
                  const prev = q.funnel[i - 1]?.count;
                  const worst = s.stage === "Quote accepted";
                  return (
                    <li key={s.stage} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                      <span className={worst ? "font-bold" : "text-ink-soft"}>{s.stage}</span>
                      <span className="flex items-center gap-2">
                        <span className={`h-5 rounded-r-md ${worst ? "bg-brand" : "bg-[#c9c9c9]"}`} style={{ width: `${(s.count / q.funnel[0].count) * 100}%`, minWidth: 4 }} />
                        <span className="tabular font-semibold">{s.count.toLocaleString("en-IN")}</span>
                      </span>
                      <span className={`tabular text-right ${worst ? "font-bold text-brand" : "text-ink-soft"}`}>{prev ? pct(s.count / prev) : ""}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-ink-soft">The share on the right is the conversion from the stage above. The steepest drop is from needs assessed to quote accepted.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Activated" value={pct(q.activationRate, 1)} sub="of all leads" />
              <Kpi label="Days to activate" value={q.avgDaysToActivate.toFixed(1)} sub="lead to live, average" />
              <Kpi label="Status chases" value={`${q.avgChaseCalls.toFixed(1)}×`} sub="calls per customer" />
              <Kpi label="Cost to acquire" value={inr(q.cacPerActivation)} sub="per activated business" />
              <Kpi label="Churn in 6 months" value={pct(q.churn6m, 1)} sub="of activated" />
              <Kpi label="Call-list model" value={q.model.auc.toFixed(2)} sub={`AUC; top 10% is ${q.model.lift.toFixed(1)}× average`} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <div className="font-bold">Why leads dropped</div>
              <ul className="mt-3 grid gap-2 text-sm">
                {q.dropReasons.map((d) => (
                  <li key={`${d.stage}${d.reason}`} className="flex justify-between gap-3"><span>{d.reason} <span className="text-ink-soft">at {d.stage.toLowerCase()}</span></span><span className="tabular font-semibold">{d.count}</span></li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <div className="font-bold">Activation by source</div>
              <ul className="mt-3 grid gap-2 text-sm">
                {q.bySource.map((s) => (
                  <li key={s.key} className="flex justify-between gap-3"><span>{s.key} <span className="text-ink-soft">({s.leads.toLocaleString("en-IN")})</span></span><span className="tabular font-semibold">{pct(s.activation, 1)}{s.cacPerActivation ? <span className="font-normal text-ink-soft"> · {inr(s.cacPerActivation)}</span> : null}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>
    </>
  );
}
