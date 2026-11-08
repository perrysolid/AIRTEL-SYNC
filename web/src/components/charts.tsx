"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Small hand-built charts for the sales portal. Thin marks, 4px rounded data
 * ends, hairline grid, text in ink tokens (never the series colour), a hover
 * tooltip on every mark, and a hidden table for screen readers.
 */

export type Fmt = "int" | "pct" | "inr";
const FORMAT: Record<Fmt, (n: number) => string> = {
  int: (n) => Math.round(n).toLocaleString("en-IN"),
  pct: (n) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`,
  inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN"),
};

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const ease = [0.2, 0.8, 0.2, 1] as const;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

function SrTable({ caption, rows }: { caption: string; rows: [string, string][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>{rows.map(([a, b]) => <tr key={a}><th scope="row">{a}</th><td>{b}</td></tr>)}</tbody>
    </table>
  );
}

/** Vertical columns over time or categories. Hover a column for its value. */
export function Columns({ data, fmt = "int", height = 180, caption, color = SERIES[0] }: { data: { label: string; value: number; tip?: string }[]; fmt?: Fmt; height?: number; caption: string; color?: string }) {
  const format = FORMAT[fmt];
  const [hover, setHover] = useState<number>();
  const reduce = useReducedMotion();
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const ticks = [0, max / 2, max];
  const last = data.length - 1;
  return (
    <figure className="relative">
      <div className="relative flex" style={{ height }}>
        <div className="flex w-10 shrink-0 flex-col justify-between pr-2 text-right text-xs text-ink-soft tabular-nums">
          {[...ticks].reverse().map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{format(t)}</span>)}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-rule" style={{ bottom: `${(t / max) * 100}%` }} />)}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div key={d.label} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(undefined)}>
                <motion.div
                  className="w-full max-w-6 rounded-t"
                  style={{ background: color, opacity: hover === undefined || hover === i ? 1 : 0.45 }}
                  initial={{ height: reduce ? `${(d.value / max) * 100}%` : 0 }}
                  animate={{ height: `${(d.value / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.025, ease }}
                />
                {(i === last || hover === i) && d.value > 0 && (
                  <span className="pointer-events-none absolute z-10 -translate-y-1 rounded-md bg-ink px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-[var(--shadow-card)]" style={{ bottom: `${(d.value / max) * 100}%` }}>
                    {hover === i && d.tip ? d.tip : format(d.value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-10 mt-1.5 flex gap-[2px] text-[11px] text-ink-soft">
        {data.map((d, i) => <span key={d.label} className="flex-1 truncate text-center">{i % Math.ceil(data.length / 8) === 0 || i === last ? d.label : ""}</span>)}
      </div>
      <SrTable caption={caption} rows={data.map((d) => [d.label, format(d.value)])} />
    </figure>
  );
}

/** Horizontal bars with the value at the tip; one series, sorted by the caller. */
export function BarList({ rows, fmt = "int", caption, color = SERIES[0] }: { rows: { label: string; value: number; sub?: string }[]; fmt?: Fmt; caption: string; color?: string }) {
  const format = FORMAT[fmt];
  const reduce = useReducedMotion();
  const max = Math.max(...rows.map((r) => r.value), 1e-9);
  return (
    <figure>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.label} title={`${r.label}: ${format(r.value)}${r.sub ? ` (${r.sub})` : ""}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{r.label}</span>
              <span className="shrink-0 tabular-nums font-semibold">{format(r.value)}{r.sub && <span className="ml-1.5 font-normal text-ink-soft">{r.sub}</span>}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-r bg-paper">
              <motion.div className="h-full rounded-r" style={{ background: color }} initial={{ width: reduce ? `${(r.value / max) * 100}%` : 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05, ease }} />
            </div>
          </li>
        ))}
      </ul>
      <SrTable caption={caption} rows={rows.map((r) => [r.label, format(r.value)])} />
    </figure>
  );
}

/** Funnel as stepped bars: each stage's width is its share of the first, with stage-to-stage conversion. */
export function Funnel({ stages, caption }: { stages: { label: string; count: number }[]; caption: string }) {
  const reduce = useReducedMotion();
  const top = Math.max(stages[0]?.count ?? 1, 1);
  return (
    <figure>
      <ol className="space-y-2.5">
        {stages.map((s, i) => {
          const conv = i > 0 && stages[i - 1].count ? s.count / stages[i - 1].count : undefined;
          return (
            <li key={s.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
              <span className="truncate font-medium">{s.label}</span>
              <div className="h-7 rounded-r bg-paper">
                <motion.div className="flex h-full items-center rounded-r pl-2 text-xs font-semibold text-white" style={{ background: SERIES[0] }} initial={{ width: reduce ? `${(s.count / top) * 100}%` : 0 }} animate={{ width: `${Math.max((s.count / top) * 100, 2)}%` }} transition={{ duration: 0.8, delay: i * 0.08, ease }}>
                  {s.count / top > 0.12 ? s.count.toLocaleString("en-IN") : ""}
                </motion.div>
              </div>
              <span className="text-right tabular-nums text-ink-soft">{s.count / top <= 0.12 && <span className="mr-1 font-semibold text-ink">{s.count.toLocaleString("en-IN")}</span>}{conv !== undefined ? `${Math.round(conv * 100)}%` : ""}</span>
            </li>
          );
        })}
      </ol>
      <SrTable caption={caption} rows={stages.map((s) => [s.label, s.count.toLocaleString("en-IN")])} />
    </figure>
  );
}

/** One segmented bar (parts of a whole) with a legend; a 2px surface gap between segments. */
export function Segments({ parts, caption }: { parts: { label: string; value: number }[]; caption: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const [hover, setHover] = useState<number>();
  return (
    <figure>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p, i) => p.value > 0 && (
          <motion.div key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(undefined)} style={{ background: SERIES[i % SERIES.length], opacity: hover === undefined || hover === i ? 1 : 0.4 }} initial={{ flexGrow: 0 }} animate={{ flexGrow: p.value / total }} transition={{ duration: 0.8, ease }} title={`${p.label}: ${p.value.toLocaleString("en-IN")}`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="text-ink-soft">{p.label}</span>
            <span className="font-semibold tabular-nums">{p.value.toLocaleString("en-IN")}</span>
          </li>
        ))}
      </ul>
      <SrTable caption={caption} rows={parts.map((p) => [p.label, p.value.toLocaleString("en-IN")])} />
    </figure>
  );
}
