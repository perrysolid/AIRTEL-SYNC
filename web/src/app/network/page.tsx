"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { NetworkOptions } from "@/components/NetworkResult";
import { PageHero, PageShell } from "@/components/SiteNav";
import type { NetworkResult } from "@/lib/network";

const CITIES = ["Pune", "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Kochi", "Nashik", "Nagpur", "Indore", "Surat", "Patna"];

export default function NetworkPage() {
  const [pin, setPin] = useState("");
  const [city, setCity] = useState("Pune");
  const [r, setR] = useState<NetworkResult>();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(p = pin, c = city) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/network", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pincode: p, city: c }) });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? "Could not check that pincode.");
        setR(undefined);
      } else setR(j);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHero eyebrow="Network Reality Check" title="Will it actually work at my shop?" sub="Check what can be installed at your address before you pay anything. No surprises, no cancelled installs." />
      <div className="card mt-6 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-40 flex-1">
            <span className="text-sm font-semibold">Pincode</span>
            <input value={pin} inputMode="numeric" maxLength={6} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && void go()} placeholder="6 digits" className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2.5 font-mono" />
          </label>
          <label className="min-w-40 flex-1">
            <span className="text-sm font-semibold">City</span>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2.5">
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <button disabled={pin.length !== 6 || busy} onClick={() => go()} className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 font-bold text-white disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />} Check my area
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">Try:</span>
          {[["411001", "Pune"], ["411016", "Pune"], ["682002", "Kochi"], ["682001", "Kochi"]].map(([p, c]) => (
            <button key={p} onClick={() => { setPin(p); setCity(c); void go(p, c); }} className="rounded-full border border-rule bg-paper px-3 py-1 font-semibold">{p} · {c}</button>
          ))}
        </div>
        {err && <p role="alert" className="mt-3 font-medium text-bad">{err}</p>}
      </div>
      {r && (
        <div className="card mt-6 p-5">
          <NetworkOptions r={r} />
          <Link href="/advisor" className="mt-4 inline-block rounded-xl bg-marigold px-5 py-3 font-extrabold text-ink">Build my plan for this address →</Link>
        </div>
      )}
    </PageShell>
  );
}
