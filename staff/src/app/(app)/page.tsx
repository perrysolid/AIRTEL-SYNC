"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApi, inr, pct } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { LeadCard } from "@/components/LeadCard";
import { Empty, Kpi, LiveDot, Loading, PageHead } from "@/components/ui";
import { ReportCard } from "@/components/ReportCard";
import { Feed } from "@/components/Feed";
import type { FeedEvent, Report } from "@/lib/types";

interface Overview {
  kpis: { open: number; due: number; hotUntouched: number; calls7: number; connected7: number; won: number; orders: number; orderMrr: number };
  funnel: { label: string; count: number }[];
  top: Lead[];
  live: { chatsToday: number; handoffs: number; ordersToday: number; updatesSent: number };
  reports: Report[];
}

export default function Today() {
  const me = useMe();
  const { data } = useApi<Overview>("/api/staff/overview", 15_000);
  const { data: feed } = useApi<{ events: FeedEvent[] }>("/api/staff/feed?limit=6", 10_000);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  if (!data) return <><PageHead title={`${hello}, ${me.name.split(" ")[0]}`} /><Loading /></>;
  const k = data.kpis;

  return (
    <>
      <PageHead
        title={`${hello}, ${me.name.split(" ")[0]}`}
        sub={me.role === "admin" ? "What the team did, from real registrations and orders." : `${k.due} follow-ups due today and ${k.hotUntouched} hot leads nobody has called yet.`}
        right={<LiveDot label="Updates every few seconds" />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Due today" value={k.due} sub={`${k.open.toLocaleString("en-IN")} open lead${k.open === 1 ? "" : "s"}`} />
        <Kpi label="Hot, not called" value={k.hotUntouched} sub="Asked for a call or got a plan" />
        <Kpi label="Calls this week" value={k.calls7} sub={k.calls7 ? `${pct(k.connected7 / k.calls7)} connected` : "None logged yet"} />
        <Kpi label="Orders" value={k.orders} sub={k.orderMrr ? `${inr(k.orderMrr)} a month, paid` : "From your leads and chats"} />
      </div>

      {me.role !== "sales" && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">{me.role === "admin" ? "Reports from your supervisor" : "Your reports"}</h2>
            <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-bold text-brand">{me.role === "admin" ? "All reports" : "Write today's"} <ArrowRight size={15} /></Link>
          </div>
          {data.reports.length ? (
            <div className="grid gap-2">{data.reports.map((r) => <ReportCard key={r.id} r={r} />)}</div>
          ) : (
            <Empty>{me.role === "admin" ? "No report yet. The supervisor sends one at the end of the day." : "You haven't sent a report yet."}</Empty>
          )}
        </section>
      )}

      {data.top.length > 0 && me.role !== "admin" && (
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Call next</h2>
          <Link href="/calls" className="inline-flex items-center gap-1 text-sm font-bold text-brand">Full list <ArrowRight size={15} /></Link>
        </div>
        <div className="grid gap-2">{data.top.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role !== "sales"} />)}</div>
      </section>
      )}

      {feed && feed.events.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">{me.role === "sales" ? "Latest" : "Latest from the team"}</h2>
            <Link href="/activity" className="inline-flex items-center gap-1 text-sm font-bold text-brand">Everything <ArrowRight size={15} /></Link>
          </div>
          <div className="card p-2"><Feed events={feed.events} /></div>
        </section>
      )}

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

    </>
  );
}
