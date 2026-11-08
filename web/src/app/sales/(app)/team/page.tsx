import { BarList, Columns } from "@/components/charts";
import { teamBoard } from "@/lib/sales-data";
import { requireStaff } from "@/lib/staff-session";
import { PageHead, Panel } from "../ui";

export default async function Team() {
  await requireStaff(["admin"]);
  const board = (await teamBoard()).sort((a, b) => b.calls7 - a.calls7);
  const first = (n: string) => n.split(" (")[0].split(" ")[0];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="Team" sub="Salespeople and channel partners, last 7 days" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Calls in the last 7 days">
          <Columns data={board.map((b) => ({ label: first(b.name), value: b.calls7, tip: `${b.calls7} calls, ${Math.round(b.connectRate * 100)}% connected` }))} caption="Calls per person, last 7 days" />
        </Panel>
        <Panel title="Overdue follow-ups" sub="Promised call-backs that have passed">
          <BarList rows={[...board].sort((a, b) => b.overdue - a.overdue).map((b) => ({ label: b.name, value: b.overdue }))} caption="Overdue follow-ups per person" color="#eb6834" />
        </Panel>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-rule text-ink-soft">
            <tr>{["Person", "Role", "Calls (7 days)", "Connected", "Open leads", "Overdue", "Quotes out", "Won"].map((h) => <th key={h} className="px-4 py-3 font-medium first:pl-5">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {board.map((b) => (
              <tr key={b.id}>
                <td className="px-5 py-3 font-semibold">{b.name}</td>
                <td className="px-4 py-3 text-ink-soft">{b.role === "partner" ? "Partner" : "Sales"}, {b.region}</td>
                <td className="px-4 py-3 tabular-nums">{b.calls7}</td>
                <td className="px-4 py-3 tabular-nums">{Math.round(b.connectRate * 100)}%</td>
                <td className="px-4 py-3 tabular-nums">{b.open.toLocaleString("en-IN")}</td>
                <td className={`px-4 py-3 tabular-nums ${b.overdue ? "font-semibold text-bad" : ""}`}>{b.overdue}</td>
                <td className="px-4 py-3 tabular-nums">{b.quotes}</td>
                <td className="px-4 py-3 tabular-nums font-semibold">{b.won}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
