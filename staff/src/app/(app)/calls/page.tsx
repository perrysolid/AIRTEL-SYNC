"use client";

import { useApi } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { LeadCard } from "@/components/LeadCard";
import { Empty, Loading, PageHead } from "@/components/ui";

export default function Calls() {
  const me = useMe();
  const { data } = useApi<{ due: Lead[]; fresh: Lead[]; openTotal: number }>("/api/staff/calls", 15_000);
  return (
    <>
      <PageHead title="Who to call" sub="Follow-ups you promised come first, then the open leads most likely to activate." />
      {!data ? (
        <Loading />
      ) : (
        <div className="grid gap-8">
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Follow-ups due today <span className="text-ink-soft">{data.due.length}</span></h2>
            {data.due.length ? <div className="grid gap-2">{data.due.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role === "admin"} />)}</div> : <Empty>No follow-ups due. Start with the list below.</Empty>}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Best chance to activate <span className="text-ink-soft">{data.fresh.length} of {data.openTotal.toLocaleString("en-IN")} open</span></h2>
            <div className="grid gap-2">{data.fresh.map((l) => <LeadCard key={l.id} l={l} showOwner={me.role === "admin"} />)}</div>
          </section>
        </div>
      )}
    </>
  );
}
