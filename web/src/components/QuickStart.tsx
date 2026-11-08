"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Calculator, GraduationCap, Scissors, Stethoscope, Store, Utensils } from "lucide-react";

const STARTERS: [typeof Store, string, string][] = [
  [Store, "Kirana & retail", "I run a kirana store"],
  [Stethoscope, "Clinic", "I run a clinic"],
  [Scissors, "Salon", "I run a salon"],
  [Calculator, "CA firm", "I run a CA firm"],
  [Utensils, "Restaurant", "I run a restaurant"],
  [GraduationCap, "Coaching", "I run a coaching centre"],
];

/** GSTIN shape: 2 digits, 5 letters, 4 digits, letter, 1-9/letter, Z, checksum. Full check happens in the advisor. */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Cuts the first questions out of the journey: pick your business type, or paste a GSTIN and the advisor fills in
 * name, address and type from the registry (GST-registered leads activate about 5× as often in the case data).
 */
export function QuickStart({ lang }: { lang: string }) {
  const router = useRouter();
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState("");
  const start = (q: string) => router.push(`/advisor?lang=${lang}&q=${encodeURIComponent(q)}`);

  return (
    <div className="mt-6 max-w-xl">
      <p className="text-sm font-semibold text-ink-soft">Or start with your business</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {STARTERS.map(([Icon, label, q]) => (
          <button key={label} onClick={() => start(q)} className="group inline-flex items-center gap-2 rounded-full border border-rule bg-white py-1.5 pr-3.5 pl-2.5 text-[14px] font-semibold transition-colors hover:border-brand hover:text-brand">
            <Icon size={16} strokeWidth={2} className="text-ink-soft transition-colors group-hover:text-brand" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = gstin.replace(/\s/g, "").toUpperCase();
          if (!GSTIN.test(v)) return setError("That doesn't look like a GSTIN: 15 characters, e.g. 27ABCDE1234F1Z5.");
          setError("");
          start(v);
        }}
      >
        <label htmlFor="qs-gstin" className="sr-only">Your GSTIN</label>
        <input
          id="qs-gstin"
          value={gstin}
          onChange={(e) => setGstin(e.target.value)}
          placeholder="Have a GSTIN? Paste it, we fill the rest"
          maxLength={20}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-rule bg-paper px-4 py-2 text-[14px] uppercase placeholder:normal-case"
        />
        <button className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white">Go <ArrowRight size={15} /></button>
      </form>
      {error && <p role="alert" className="mt-1.5 text-sm text-bad">{error}</p>}
    </div>
  );
}
