"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApi, inr, pct } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { LeadCard } from "@/components/LeadCard";
import { Kpi, LiveDot, Loading, PageHead } from "@/components/ui";

interface Overview {
  kpis: { open: number; due: number; hotUntouched: number; calls7: number; connected7: number; won: number; orders: number; orderMrr: number };
  funnel: { label: string; count: number }[];
  top: Lead[];
  live: { chatsToday: number; handoffs: number; ordersToday: number; updatesSent: number };
  quarter: null | {
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
}

export default function Today() {
  const me = useMe();
  const { data } = useApi<Overview>("/api/staff/overview", 15_000);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  if (!data) return <><PageHead title={`${hello}, ${me.name.split(" ")[0]}`} /><Loading /></>;
  const k = data.kpis;
  const q = data.quarter;

  return (
    <>
      <PageHead
        title={`${hello}, ${me.name.split(" ")[0]}`}
        sub={me.role === "admin" ? "Every team, every lead, every order." : `${k.due} follow-ups due today and ${k.hotUntouched} hot leads nobody has called yet.`}
        right={<LiveDot label="Updates every few seconds" />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Due today" value={k.due} sub={`${k.open.toLocaleString("en-IN")} open leads`} />
        <Kpi label="Hot, not called" value={k.hotUntouched} sub="Best chance to activate" />
        <Kpi label="Calls this week" value={k.calls7} sub={k.calls7 ? `${pct(k.connected7 / k.calls7)} connected` : "None logged yet"} />
        <Kpi label="Orders" value={k.orders} sub={k.orderMrr ? `${inr(k.orderMrr)} a month, paid` : "From your leads and chats"} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Call next</h2>
          <Link href="/calls" className="inline-flex items-center gap-1 text-sm font-bold text-brand">Full list <ArrowRight size={15} /></Link>
        </div>
        <div className="grid gap-2">{data.top.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role === "admin"} />)}</div>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-4">
        {[
          ["Advisor chats today", data.live.chatsToday, "/chats"],
          ["Asked for a person", data.live.handoffs, "/chats"],
          ["Orders today", data.live.ordersToday, "/orders"],
          ["Updates sent to owners", data.live.updatesSent, "/orders"],
        ].map(([label, n, href]) => (
          <Link key={label as string} href={href as string} className="card flex items-center justify-between p-4 hover:border-ink/25">
            <span className="text-sm font-semibold text-ink-soft">{label}</span>
            <span className="tabular text-2xl font-extrabold">{n}</span>
          </Link>
        ))}
      </section>

      {q && (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Last quarter, before digital</h2>
          <p className="text-ink-soft">5,000 leads from April to June. The numbers this portal and the advisor are built to move.</p>
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
      )}
    </>
  );
}
