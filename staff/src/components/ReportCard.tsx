import { ago } from "@/lib/api";
import type { Report } from "@/lib/types";

/** One end-of-day report from the supervisor, as written. */
export function ReportCard({ r }: { r: Report }) {
  return (
    <article className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{r.by}</span>
        <span className="text-xs text-ink-soft">{new Date(r.at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, {ago(r.at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{r.text}</p>
    </article>
  );
}
