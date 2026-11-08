"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useApi } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { LeadCard } from "@/components/LeadCard";
import { Empty, Loading, PageHead } from "@/components/ui";

const STATUS = [
  ["open", "Open"],
  ["to_call", "To call"],
  ["contacted", "Contacted"],
  ["interested", "Interested"],
  ["quote_sent", "Quote sent"],
  ["won", "Won"],
  ["lost", "Lost"],
  ["all", "All"],
] as const;

export default function Leads() {
  const me = useMe();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [band, setBand] = useState("");
  const [book, setBook] = useState<"registered" | "winback">("registered");
  const dq = useDeferredValue(q);
  const params = new URLSearchParams({ book, status, q: dq, ...(band ? { band } : {}) });
  const { data } = useApi<{ total: number; leads: Lead[] }>(`/api/staff/leads?${params}`, 20_000);
  const chip = (on: boolean) => `whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-ink bg-ink text-white" : "border-rule bg-sheet text-ink-soft hover:text-ink"}`;
  return (
    <>
      <PageHead title={me.role === "sales" ? "My leads" : "All leads"} sub={data ? `${data.total.toLocaleString("en-IN")} ${book === "winback" ? "recoverable drops from last quarter, ranked by the propensity model" : "businesses that registered with us, most likely to buy first"}` : undefined} />
      <div role="tablist" className="mb-4 inline-flex rounded-full border border-rule bg-sheet p-1">
        {([["registered", "Registered"], ["winback", "Win-back (last quarter)"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={book === k} onClick={() => setBook(k)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${book === k ? "bg-ink text-white" : "text-ink-soft"}`}>{label}</button>
        ))}
      </div>
      <label className="relative block">
        <span className="sr-only">Search leads</span>
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-soft" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business, city or lead ID" className="w-full rounded-2xl border border-rule bg-sheet py-3 pr-3 pl-10 outline-none focus:border-ink" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {STATUS.map(([k, label]) => <button key={k} onClick={() => setStatus(k)} className={chip(status === k)}>{label}</button>)}
        <span className="mx-1 w-px shrink-0 bg-rule" />
        {(["hot", "warm", "cold"] as const).map((b) => <button key={b} onClick={() => setBand(band === b ? "" : b)} className={chip(band === b)}>{b[0].toUpperCase() + b.slice(1)}</button>)}
      </div>
      <div className="mt-4">
        {!data ? <Loading /> : data.leads.length ? <div className="grid gap-2">{data.leads.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role !== "sales"} />)}</div> : <Empty>No leads match. Try another filter.</Empty>}
      </div>
    </>
  );
}
