"use client";

import { pct, useApi } from "@/lib/api";
import { Loading, PageHead } from "@/components/ui";

interface Row { id: string; name: string; role: string; region?: string; calls7: number; connectRate: number; open: number; overdue: number; won: number; quotes: number }

export default function Team() {
  const { data } = useApi<{ team: Row[] }>("/api/staff/team", 20_000);
  return (
    <>
      <PageHead title="Team" sub="Each salesperson's and partner's last seven days, and the book they hold." />
      {!data ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-ink-soft">
              <tr className="border-b border-rule">
                {["Name", "Region", "Calls (7 days)", "Connected", "Open leads", "Overdue", "Quotes out", "Won"].map((h, i) => <th key={h} className={`px-4 py-3 font-semibold ${i > 1 ? "text-right" : ""}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.team.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3"><div className="font-bold">{r.name}</div><div className="text-xs text-ink-soft">{r.role === "partner" ? "Channel partner" : "Field sales"}</div></td>
                  <td className="px-4 py-3">{r.region ?? ""}</td>
                  <td className="tabular px-4 py-3 text-right">{r.calls7}</td>
                  <td className="tabular px-4 py-3 text-right">{r.calls7 ? pct(r.connectRate) : ""}</td>
                  <td className="tabular px-4 py-3 text-right">{r.open.toLocaleString("en-IN")}</td>
                  <td className={`tabular px-4 py-3 text-right ${r.overdue ? "font-bold text-brand" : ""}`}>{r.overdue}</td>
                  <td className="tabular px-4 py-3 text-right">{r.quotes}</td>
                  <td className="tabular px-4 py-3 text-right">{r.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
