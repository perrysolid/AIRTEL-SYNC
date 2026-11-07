"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

interface PurposeInfo {
  required: boolean;
  title: string;
  detail: string;
  data: string[];
  retention: string;
}

/** DPDP-style notice: itemised purposes, what data, how long; required ones explained, optional ones off by default. */
export function ConsentStep({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [purposes, setPurposes] = useState<Record<string, PurposeInfo>>();
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/kyc/consent").then(async (r) => {
      const j = await r.json();
      setPurposes(j.purposes);
      setChosen(Object.fromEntries(Object.entries(j.purposes as Record<string, PurposeInfo>).map(([k, v]) => [k, v.required])));
    });
  }, []);

  if (!purposes) return null;

  const submit = async () => {
    setBusy(true);
    const r = await fetch("/api/kyc/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, purposes: chosen }) });
    setBusy(false);
    if (!r.ok) return setError((await r.json()).error);
    onDone();
  };

  return (
    <section>
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-ok" />
        <h2 className="text-2xl font-extrabold">Before we read your documents</h2>
      </div>
      <p className="mt-1 text-ink-soft">Here is exactly what we&apos;ll use your details for. You can withdraw optional permissions any time.</p>
      <ul className="mt-4 space-y-3">
        {Object.entries(purposes).map(([key, p]) => (
          <li key={key} className="rounded-xl border border-rule bg-sheet p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-[var(--ink)]"
                checked={!!chosen[key]}
                disabled={p.required}
                onChange={(e) => setChosen((c) => ({ ...c, [key]: e.target.checked }))}
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-bold">
                  {p.title}
                  {p.required ? <span className="inline-flex items-center gap-1 rounded bg-paper px-1.5 text-xs font-medium text-ink-soft"><Lock size={11} /> needed</span> : <span className="rounded bg-paper px-1.5 text-xs font-medium text-ink-soft">optional</span>}
                </span>
                <span className="mt-1 block text-[15px]">{p.detail}</span>
                <details className="mt-1.5 text-sm text-ink-soft">
                  <summary className="cursor-pointer font-medium">What we use and for how long</summary>
                  <p className="mt-1">Uses: {p.data.join(", ")}.</p>
                  <p className="mt-1">{p.retention}</p>
                </details>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-soft">
        Data fiduciary: Accel Telecom Ltd (fictional). Grievance officer: privacy@accel.example · Notice version 2026-07-v1. You can also read this in हिन्दी and 8 other languages.
      </p>
      {error && <p role="alert" className="mt-2 font-medium text-bad">{error}</p>}
      <button onClick={submit} disabled={busy} className="mt-4 w-full rounded-xl bg-brand px-4 py-3.5 text-lg font-extrabold text-white disabled:opacity-60">
        {busy ? "Saving…" : "I agree — continue"}
      </button>
    </section>
  );
}
