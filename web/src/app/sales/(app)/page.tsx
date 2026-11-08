import Link from "next/link";
import { BarList, Columns, Funnel, Segments } from "@/components/charts";
import { inr } from "@/lib/format";
import { dashboard } from "@/lib/sales-data";
import { requireStaff } from "@/lib/staff-session";
import { Kpi, LeadLine, PageHead, Panel } from "./ui";

export default async function Overview() {
  const staff = await requireStaff();
  const d = await dashboard(staff);
  const scope = staff.role === "admin" ? "the whole team" : staff.role === "partner" ? "your partner book" : `your ${staff.region} book`;
  const first = staff.name.split(" ")[0];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title={`Good to see you, ${first}`} sub={`Here's ${scope} today.`}>
        <Link href="/sales/calls" className="btn-primary rounded-full px-5 py-2.5">Start calling</Link>
      </PageHead>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi accent label="Follow-ups due today" value={d.kpis.due.toLocaleString("en-IN")} note={`${d.kpis.hotUntouched} hot leads not called yet`} />
        <Kpi label="Open leads" value={d.kpis.open.toLocaleString("en-IN")} note="To call, contacted, interested or quoted" />
        <Kpi label="Calls in the last 7 days" value={d.kpis.calls7.toLocaleString("en-IN")} note={`${d.kpis.calls7 ? Math.round((d.kpis.connected7 / d.kpis.calls7) * 100) : 0}% connected`} />
        <Kpi label="Won and ordered" value={`${d.kpis.won} won`} note={`${d.kpis.orders} digital orders, ${inr(d.kpis.orderMrr)}/mo paid`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Calls per day" sub="Last 14 days. Hover a day for connects.">
          <Columns data={d.callsByDay} caption="Calls per day, last 14 days" />
        </Panel>
        <Panel title="Where your book stands" sub="Current status of every lead you own">
          <Segments parts={d.statusParts} caption="Leads by status" />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Call these first" sub="Due follow-ups, then the best untouched leads">
          <div className="-mx-5 -mb-5 divide-y divide-rule border-t border-rule">
            {d.top.map((l) => <LeadLine key={l.id} l={l} />)}
            {!d.top.length && <p className="px-5 py-6 text-ink-soft">Nothing due. Your queue is clear.</p>}
          </div>
        </Panel>
        <Panel title="Chance to activate, open leads" sub="How many open leads fall in each score band">
          <Columns data={d.scoreDist} caption="Open leads by propensity band" color="#e4002b" />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Funnel, last quarter" sub="How far your leads got, with stage-to-stage conversion">
          <Funnel stages={d.funnel} caption="Lead funnel" />
        </Panel>
        <Panel title="Activation rate by lead source" sub="Where your activations actually come from">
          <BarList rows={d.bySource} fmt="pct" caption="Activation rate by source" />
        </Panel>
      </div>
    </div>
  );
}
