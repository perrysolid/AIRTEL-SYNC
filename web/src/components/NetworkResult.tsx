import { Check, X } from "lucide-react";
import type { NetworkResult } from "@/lib/network";

function Signal({ q }: { q: number }) {
  const bars = Math.round(q / 25);
  return (
    <span className="inline-flex items-end gap-0.5" role="img" aria-label={`Signal ${q}%`}>
      {[8, 12, 16, 22].map((h, i) => <i key={i} className={`w-1.5 rounded-sm ${i < bars ? "bg-signal" : "bg-rule"}`} style={{ height: h }} />)}
    </span>
  );
}

/** What can be installed at an address: fibre, 5G AirFiber, leased line; the recommended one highlighted. */
export function NetworkOptions({ r }: { r: NetworkResult }) {
  const tone = r.recommended === "fibre" ? "border-ok bg-ok/10" : r.recommended === "airfiber" ? "border-signal bg-signal/10" : "border-marigold-deep bg-marigold/15";
  return (
    <div>
      <div className={`flex gap-3 rounded-2xl border-2 p-4 ${tone}`}>
        <span className="text-2xl" aria-hidden>{r.recommended === "fibre" ? "✅" : r.recommended === "airfiber" ? "📡" : "🧭"}</span>
        <p className="font-semibold">{r.message}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {r.options.map((o) => (
          <li key={o.key} className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${o.key === r.recommended ? "border-ok bg-ok/10" : "border-rule bg-sheet"} ${o.available ? "" : "opacity-60"}`}>
            {o.available ? <Check className="shrink-0 text-ok" /> : <X className="shrink-0 text-ink-soft" />}
            <div className="min-w-0 flex-1">
              <div className="font-bold">{o.name} {o.key === r.recommended && <span className="ml-1 rounded-full bg-ok px-2 py-0.5 text-xs text-white">Recommended</span>}</div>
              <div className="text-sm text-ink-soft">{o.note}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{o.available ? `~${o.installDays} days` : "Not available"}</div>
              <div className="text-sm text-ink-soft">{o.speed}</div>
              {o.signal && o.available && <Signal q={o.signal} />}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-ink-soft">Coverage in this demo is simulated from the pincode; a live build would call Accel&apos;s serviceability API.</p>
    </div>
  );
}
