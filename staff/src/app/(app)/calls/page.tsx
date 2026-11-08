"use client";

import { useApi } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { LeadCard } from "@/components/LeadCard";
import { Empty, Loading, PageHead } from "@/components/ui";

export default function Calls() {
  const me = useMe();
  const { data } = useApi<{ due: Lead[]; fresh: Lead[]; winback: Lead[]; openTotal: number; winbackTotal: number }>("/api/staff/calls", 15_000);
  return (
    <>
      <PageHead title="Who to call" sub="Follow-ups you promised come first, then businesses that registered with us, then last quarter's drops most likely to come back." />
      {!data ? (
        <Loading />
      ) : (
        <div className="grid gap-8">
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Follow-ups due today <span className="text-ink-soft">{data.due.length}</span></h2>
            {data.due.length ? <div className="grid gap-2">{data.due.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role !== "sales"} />)}</div> : <Empty>No follow-ups due. Start with the list below.</Empty>}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Registered, not called yet <span className="text-ink-soft">{data.fresh.length} of {data.openTotal.toLocaleString("en-IN")} open</span></h2>
            {data.fresh.length ? <div className="grid gap-2">{data.fresh.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role !== "sales"} />)}</div> : <Empty>Everyone who registered has been called.</Empty>}
          </section>
          <section>
            <h2 className="text-lg font-extrabold">Win back from last quarter <span className="text-ink-soft">top {data.winback.length} of {data.winbackTotal.toLocaleString("en-IN")}</span></h2>
            <p className="mb-3 text-sm text-ink-soft">Leads from smb_leads.csv that dropped for a reason a call can fix, ranked by the propensity model.</p>
            <div className="grid gap-2">{data.winback.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role !== "sales"} />)}</div>
          </section>
        </div>
      )}
    </>
  );
}
