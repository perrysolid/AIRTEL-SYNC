"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Product } from "@/lib/catalogue";
import { inr } from "@/lib/format";

const CATS = ["All", "Connectivity", "Communication", "Cloud & Productivity", "Security", "IoT & Physical"];
const ICON: Record<string, string> = { Connectivity: "📶", Communication: "💬", "Cloud & Productivity": "☁️", Security: "🛡️", "IoT & Physical": "📹" };
const SEG: Record<string, string> = { micro: "Micro", prof: "Professional", multi: "Multi-site", mfg: "Manufacturing" };

export function ProductBrowser({ products }: { products: Product[] }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [noGst, setNoGst] = useState(false);
  const [maxPrice, setMaxPrice] = useState(0);
  const [sort, setSort] = useState<"cat" | "price" | "install">("cat");

  const rows = useMemo(() => {
    let r = products.filter((p) => (cat === "All" || p.category === cat) && (!noGst || !p.requiresGstin) && (!maxPrice || p.priceMin <= maxPrice) && (!q || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q.toLowerCase())));
    if (sort === "price") r = [...r].sort((a, b) => a.priceMin - b.priceMin);
    if (sort === "install") r = [...r].sort((a, b) => a.installDays - b.installDays);
    return r;
  }, [products, cat, q, noGst, maxPrice, sort]);

  return (
    <>
      <div className="card mt-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-56 flex-[2]">
            <span className="sr-only">Search products</span>
            <Search size={18} className="pointer-events-none absolute top-3.5 left-3 text-ink-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: fibre, WhatsApp, CCTV…" className="w-full rounded-xl border border-rule bg-paper py-3 pr-3 pl-10" />
          </label>
          <label className="min-w-40"><span className="text-sm font-semibold">Starting price up to</span>
            <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-3"><option value={0}>Any</option><option value={500}>₹500/mo</option><option value={1000}>₹1,000/mo</option><option value={2500}>₹2,500/mo</option><option value={5000}>₹5,000/mo</option></select></label>
          <label className="min-w-36"><span className="text-sm font-semibold">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-3"><option value="cat">Category</option><option value="price">Lowest price</option><option value="install">Fastest install</option></select></label>
          <label className="flex min-h-12 items-center gap-2 font-semibold"><input type="checkbox" checked={noGst} onChange={(e) => setNoGst(e.target.checked)} className="h-4 w-4" /> No GSTIN needed</label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Category">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${cat === c ? "border-brand bg-brand text-white" : "border-rule bg-sheet text-ink-soft"}`}>{ICON[c]} {c}</button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-soft" aria-live="polite">{rows.length} product{rows.length === 1 ? "" : "s"}</p>
      <ul className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <li key={p.id} className="card flex flex-col gap-2 p-5">
            <div className="flex items-center justify-between"><span className="text-2xl" aria-hidden>{ICON[p.category]}</span><span className="rounded bg-paper px-2 py-0.5 font-mono text-xs font-bold">{p.id}</span></div>
            <h2 className="text-lg font-extrabold">{p.name}</h2>
            <p className="text-sm text-ink-soft">{p.description}</p>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{inr(p.priceMin)}{p.priceMax > p.priceMin ? ` – ${inr(p.priceMax)}` : ""}<span className="text-sm font-semibold text-ink-soft"> {p.unit}/mo</span></div>
            <div className="flex flex-wrap gap-1.5 text-xs font-bold">
              <span className="rounded-md bg-paper px-2 py-1">{p.minContract}-month min</span>
              <span className="rounded-md bg-paper px-2 py-1">Setup {inr(p.setupFee)}</span>
              <span className="rounded-md bg-paper px-2 py-1">Live ~{p.installDays}d</span>
              {p.requiresGstin ? <span className="rounded-md bg-warn/25 px-2 py-1 text-warn">GSTIN needed</span> : <span className="rounded-md bg-ok/15 px-2 py-1 text-ok">No GSTIN</span>}
              {p.requiresOneOf.length > 0 && <span className="rounded-md bg-signal/15 px-2 py-1 text-signal">Needs an internet plan</span>}
              {p.minEmployees > 1 && <span className="rounded-md bg-paper px-2 py-1">{p.minEmployees}+ people</span>}
              {p.minSites > 1 && <span className="rounded-md bg-paper px-2 py-1">{p.minSites}+ sites</span>}
              {p.tiers.length === 1 && <span className="rounded-md bg-paper px-2 py-1">Tier-{p.tiers[0]} only</span>}
            </div>
            <div className="mt-auto pt-1 text-xs text-ink-soft">For: {p.segments.map((s) => SEG[s] ?? s).join(" · ")}</div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <div className="card mt-4 p-6 text-center text-ink-soft">No products match. Try clearing a filter.</div>}
      <div className="card mt-6 p-6 text-center"><div className="font-bold">Not sure what you need?</div><p className="text-ink-soft">The advisor recommends the right products and checks eligibility for you.</p><Link href="/advisor" className="mt-3 inline-block rounded-xl bg-brand px-5 py-2.5 font-extrabold text-white">Ask the advisor</Link></div>
    </>
  );
}
