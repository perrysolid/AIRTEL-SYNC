"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { NetworkOptions } from "@/components/NetworkResult";
import type { NetworkResult } from "@/lib/network";

/** Quote-page card: check the install address first. If fibre isn't available the plan switches to 5G AirFiber on the spot. */
export function NetworkCard({ sessionId, initialPin, onChanged }: { sessionId: string; initialPin?: string; onChanged: () => void }) {
  const [pin, setPin] = useState(initialPin ?? "");
  const [r, setR] = useState<(NetworkResult & { changed?: boolean }) | undefined>();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/network", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pincode: pin, sessionId }) });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? "Could not check that pincode.");
        setR(undefined);
        return;
      }
      setR(j);
      if (j.changed) onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-rule bg-sheet p-4" aria-labelledby="netcheck">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="netcheck" className="font-bold">📡 Will it work at your address?</h2>
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">Network Reality Check</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Enter your shop&apos;s pincode. If fibre hasn&apos;t reached you, we switch your plan to 5G AirFiber automatically, so the install never gets cancelled.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input aria-label="Pincode" value={pin} inputMode="numeric" maxLength={6} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && void check()} placeholder="Pincode" className="w-36 rounded-xl border border-rule bg-paper px-3 py-2.5 font-mono" />
        <button disabled={pin.length !== 6 || busy} onClick={check} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-bold text-white disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} Check</button>
        <span className="text-xs text-ink-soft">Try 411016 (Pune) to see the fallback.</span>
      </div>
      {err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{err}</p>}
      {r && (
        <div className="mt-3">
          <NetworkOptions r={r} />
          {r.changed && <p role="status" className="mt-3 rounded-xl border border-signal bg-signal/10 p-3 text-sm font-semibold">Your plan was updated for this address. Check the bill below.</p>}
        </div>
      )}
    </section>
  );
}
