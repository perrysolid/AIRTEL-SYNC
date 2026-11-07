"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Headset, MessageCircle, Search, ShieldAlert } from "lucide-react";
import { PageHero, PageShell } from "@/components/SiteNav";
import { FAQ } from "@/lib/site-content";

const CATS = ["All", ...Array.from(new Set(FAQ.map((f) => f.cat)))];

export default function HelpPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => FAQ.filter((f) => (cat === "All" || f.cat === cat) && (!q || `${f.q} ${f.a}`.toLowerCase().includes(q.toLowerCase()))), [q, cat]);

  return (
    <PageShell>
      <PageHero eyebrow="Help centre" title="How can we help?" sub="Search the answers below, or reach us the way that suits you." />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          [MessageCircle, "Chat on WhatsApp", "Status, rescheduling and troubleshooting in one chat.", "/whatsapp"],
          [Headset, "Talk to a person", "Ask the advisor for a call; a local partner calls within 2 working hours.", "/advisor"],
          [ShieldAlert, "Check a suspicious message", "Paste it or upload a screenshot.", "/shield"],
        ].map(([Icon, title, text, href]) => {
          const I = Icon as typeof Headset;
          return (
            <Link key={href as string} href={href as string} className="card flex flex-col gap-1 p-5 transition-transform hover:-translate-y-0.5">
              <I size={26} className="text-brand" /><div className="mt-1 font-bold">{title as string}</div><div className="text-sm text-ink-soft">{text as string}</div>
            </Link>
          );
        })}
      </div>

      <div className="card mt-6 p-4">
        <label className="relative block">
          <span className="sr-only">Search help</span>
          <Search size={18} className="pointer-events-none absolute top-3.5 left-3 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: GSTIN, install time, outage…" className="w-full rounded-xl border border-rule bg-paper py-3 pr-3 pl-10" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Topic">
          {CATS.map((c) => <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${cat === c ? "border-brand bg-brand text-white" : "border-rule bg-sheet text-ink-soft"}`}>{c}</button>)}
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {rows.map((f) => (
          <div key={f.q} className={`overflow-hidden rounded-2xl border-2 bg-sheet ${open === f.q ? "border-brand" : "border-rule"}`}>
            <button onClick={() => setOpen(open === f.q ? null : f.q)} aria-expanded={open === f.q} className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3 text-left font-bold">
              <span><span className="mr-2 rounded-md bg-paper px-2 py-0.5 text-xs font-bold text-ink-soft">{f.cat}</span>{f.q}</span>
              <span aria-hidden className="text-2xl font-normal text-brand">{open === f.q ? "–" : "+"}</span>
            </button>
            {open === f.q && <p className="px-5 pb-4 text-ink-soft">{f.a}</p>}
          </div>
        ))}
        {rows.length === 0 && <div className="card p-6 text-center text-ink-soft">No answers found. Try WhatsApp or ask for a person above.</div>}
      </div>
    </PageShell>
  );
}
