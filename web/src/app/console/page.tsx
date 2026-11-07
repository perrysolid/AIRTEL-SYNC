"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, PhoneCall, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Brand";
import { inr } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ConsoleData = any;

const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(d)}%`);

export default function ConsolePage() {
  const [data, setData] = useState<ConsoleData>();
  const [tab, setTab] = useState<"queue" | "calls" | "orders" | "service" | "insights">("queue");
  const [nudged, setNudged] = useState<Record<string, string>>({});
  const nudge = async (id: string) => {
    const r = await fetch("/api/console/nudge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) });
    const j = await r.json();
    setNudged((n) => ({ ...n, [id]: r.ok ? "Nudge sent ✓" : j.error }));
  };
  const load = async () => setData(await (await fetch("/api/console", { cache: "no-store" })).json());
  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="grid h-dvh place-items-center text-ink-soft"><Loader2 className="animate-spin" /></div>;
  const s = data.summary;
  const maxFunnel = s.funnel[0].count;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo small />
            <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-white">Partner & sales console</span>
          </div>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-ink-soft"><RefreshCw size={14} /> Refresh</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Lead → activation (last quarter, assisted)" value={pct(s.activationRate)} target="target 15% with digital journey" />
          <Kpi label="Days from lead to activation" value={s.avgDaysToActivate.toFixed(1)} target="target under 5 (SIMs same day)" />
          <Kpi label="Acquisition cost per activation" value={inr(s.cacPerActivation)} target="target under ₹6,000" />
          <Kpi label="Status-chasing calls per customer" value={s.avgChaseCalls.toFixed(1)} target="target under 0.5" />
        </section>

        <nav className="mt-8 flex gap-1 border-b border-rule" aria-label="Console sections">
          {([
            ["queue", `Advisor hand-offs (${data.unclosed.length})`],
            ["calls", "Who to call today"],
            ["orders", `Orders (${data.orders.length})`],
            ["service", `Service health (${data.service.tickets.filter((t: any) => t.status === "Open").length} open)`],
            ["insights", "Funnel insights"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? "border-brand" : "border-transparent text-ink-soft"}`}>
              {label}
            </button>
          ))}
        </nav>

        {tab === "queue" && (
          <section className="mt-4">
            <p className="text-ink-soft">Conversations the advisor couldn&apos;t close. Each has the owner&apos;s facts and quote, so you can call without asking them to repeat anything.</p>
            {data.unclosed.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-rule p-6 text-center text-ink-soft">No open hand-offs. Start a chat in the <Link href="/advisor" className="underline">advisor</Link> and ask for a call to see one appear here.</p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {data.unclosed.map((u: any) => (
                  <article key={u.id} className="rounded-xl border border-rule bg-sheet p-4">
                    <div className="flex items-center justify-between">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${u.status === "handoff" ? "bg-brand text-white" : "bg-paper text-ink-soft"}`}>{u.reason}</span>
                      <span className="text-xs text-ink-soft">{u.channel} · {u.language} · {new Date(u.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="mt-2 font-semibold">{u.summary || "Not enough details yet"}</p>
                    {u.lastOwnerMessage && <p className="mt-1 text-sm text-ink-soft">Last said: “{u.lastOwnerMessage}”</p>}
                    <div className="mt-3 flex gap-2">
                      {u.quoteMonthly && <Link href={`/quote/${u.id}`} className="rounded-lg border border-rule px-3 py-1.5 text-sm font-semibold">Open quote ({inr(u.quoteMonthly)}/mo)</Link>}
                      <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"><PhoneCall size={14} /> Claim & call</button>
                      {u.canNudge && <button onClick={() => nudge(u.id)} className="rounded-lg border border-rule px-3 py-1.5 text-sm font-semibold">🔔 Nudge in chat</button>}
                    </div>
                    {nudged[u.id] && <p role="status" className="mt-2 text-sm font-medium text-ink-soft">{nudged[u.id]}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "service" && (
          <section className="mt-4">
            <p className="text-ink-soft">Support tickets raised automatically (outages) or by owners in chat, routed to the partner for their city with an SLA.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Kpi label="Active outages" value={String(data.service.activeOutages)} target="live from router telemetry in production" />
              <Kpi label="Branches opened" value={String(data.service.branches)} target="Branch-in-a-Box orders" />
              <Kpi label="Install slots booked" value={String(data.service.booked)} target="self-serve scheduler" />
            </div>
            {data.service.tickets.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-rule p-6 text-center text-ink-soft">No tickets yet. Open an order, go to Health &amp; backup and simulate an outage to see one appear here.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-rule bg-sheet">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-rule text-ink-soft"><tr><th className="p-3">Ticket</th><th className="p-3">Business</th><th className="p-3">Issue</th><th className="p-3">Assigned to</th><th className="p-3">Status</th></tr></thead>
                  <tbody>
                    {data.service.tickets.map((t: any) => (
                      <tr key={t.id} className="border-b border-rule last:border-0">
                        <td className="p-3 font-mono">{t.id}</td>
                        <td className="p-3"><div className="font-semibold">{t.business}</div><div className="text-ink-soft">{t.city} · <Link href={`/order/${t.orderId}`} className="underline">{t.orderId}</Link></div></td>
                        <td className="p-3">{t.kind.replace("_", " ")}<div className="text-ink-soft">{t.detail}</div></td>
                        <td className="p-3">{t.assignedTo}</td>
                        <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-bold ${t.status === "Resolved" ? "bg-ok/15 text-ok" : "bg-warn/25 text-warn"}`}>{t.status} · SLA {t.slaHours}h</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "calls" && (
          <section className="mt-4">
            <p className="text-ink-soft">
              Leads that dropped for fixable reasons, ranked by likelihood to activate. Model: logistic regression on lead-time facts only · AUC {data.summary.model.auc} · top 10% activate {data.summary.model.lift}× more than average.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-rule bg-sheet">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-rule text-ink-soft">
                  <tr><th className="p-3">Business</th><th className="p-3">Why they dropped</th><th className="p-3">Language</th><th className="p-3">Score</th><th className="p-3">Why this score</th></tr>
                </thead>
                <tbody>
                  {data.callList.map((c: any) => (
                    <tr key={c.id} className="border-b border-rule last:border-0">
                      <td className="p-3"><div className="font-semibold">{c.business}</div><div className="text-ink-soft">{c.type} · {c.city} · {c.contact}</div></td>
                      <td className="p-3">{c.dropReason}<div className="text-ink-soft">at {c.stage} · via {c.source}</div></td>
                      <td className="p-3">{c.language}</td>
                      <td className="p-3"><span className={`rounded px-2 py-0.5 font-bold ${c.band === "hot" ? "bg-ok/15 text-ok" : c.band === "warm" ? "bg-warn/20 text-ink" : "bg-paper text-ink-soft"}`}>{pct(c.probability, 0)}</span></td>
                      <td className="p-3 text-ink-soft">{c.reasons.map((r: any) => `${r.effect > 0 ? "+" : "−"} ${r.label}`).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "orders" && (
          <section className="mt-4">
            {data.orders.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-rule p-6 text-center text-ink-soft">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-rule bg-sheet">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-rule text-ink-soft"><tr><th className="p-3">Order</th><th className="p-3">Business</th><th className="p-3">Channel</th><th className="p-3">Monthly</th><th className="p-3">KYC</th><th className="p-3">Stage</th></tr></thead>
                  <tbody>
                    {data.orders.map((o: any) => (
                      <tr key={o.id} className="border-b border-rule last:border-0 align-top">
                        <td className="p-3"><Link href={`/order/${o.id}`} className="font-mono text-xs underline">{o.id}</Link><div className="text-ink-soft">{o.phone}</div></td>
                        <td className="p-3 font-semibold">{o.business}<div className="font-normal text-ink-soft">{o.city}</div></td>
                        <td className="p-3">{o.channel}{o.partnerCode && <div className="text-ink-soft">partner {o.partnerCode}</div>}</td>
                        <td className="p-3 tabular-nums">{inr(o.monthly)}</td>
                        <td className="p-3"><span className={o.kyc === "verified" ? "text-ok" : o.kyc === "rejected" ? "text-bad" : "text-warn"}>{o.kyc}</span>{o.kycIssues.length > 0 && <div className="text-ink-soft">{o.kycIssues.join("; ")}</div>}</td>
                        <td className="p-3">{o.stage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-sm text-ink-soft">Consent ledger: {data.consents.total} records · head {data.consents.ledgerHead ?? "—"} (hash-chained)</p>
          </section>
        )}

        {tab === "insights" && (
          <section className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-rule bg-sheet p-4">
              <h3 className="font-bold">Where leads drop (Apr–Jun 2026, assisted journey)</h3>
              <ul className="mt-3 space-y-2">
                {s.funnel.map((f: any, i: number) => (
                  <li key={f.stage}>
                    <div className="flex justify-between text-sm"><span>{f.stage}</span><span className="tabular-nums">{f.count.toLocaleString("en-IN")}{i > 0 && <span className="text-ink-soft"> · {pct(f.count / s.funnel[i - 1].count, 0)}</span>}</span></div>
                    <div className="mt-1 h-3 rounded bg-paper"><div className="h-3 rounded bg-brand" style={{ width: `${(f.count / maxFunnel) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rule bg-sheet p-4">
              <h3 className="font-bold">Chasing status predicts churn</h3>
              <p className="text-sm text-ink-soft">6-month churn of activated customers by how often they called to chase.</p>
              <ul className="mt-3 space-y-2">
                {s.churnByChaseCalls.map((c: any) => (
                  <li key={c.calls} className="flex items-center gap-3 text-sm">
                    <span className="w-16 shrink-0">{c.calls} call{c.calls > 1 ? "s" : ""}</span>
                    <div className="h-3 flex-1 rounded bg-paper"><div className="h-3 rounded bg-bad" style={{ width: `${c.churn * 300}%` }} /></div>
                    <span className="w-12 text-right tabular-nums">{pct(c.churn, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rule bg-sheet p-4 lg:col-span-2">
              <h3 className="font-bold">Channel economics</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-ink-soft"><tr><th className="py-2">Source</th><th>Leads</th><th>Activation</th><th>Cost per activation</th><th>6-mo churn</th></tr></thead>
                  <tbody>
                    {s.bySource.map((r: any) => (
                      <tr key={r.key} className="border-t border-rule"><td className="py-2 font-semibold">{r.key}</td><td className="tabular-nums">{r.leads}</td><td>{pct(r.activation)}</td><td className="tabular-nums">{r.cacPerActivation ? inr(r.cacPerActivation) : "—"}</td><td>{pct(r.churn, 0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-rule bg-sheet p-4 lg:col-span-2">
              <h3 className="font-bold">Top drop reasons</h3>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {s.dropReasons.slice(0, 12).map((d: any) => (
                  <li key={d.stage + d.reason} className="flex justify-between border-b border-rule py-1"><span>{d.reason} <span className="text-ink-soft">({d.stage})</span></span><span className="tabular-nums">{d.count}</span></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-10">
          <h3 className="font-bold">Audit log</h3>
          <p className="text-sm text-ink-soft">Identifiers are masked before they reach logs.</p>
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-rule bg-sheet p-3 font-mono text-xs">
            {data.audit.length === 0 && <li className="text-ink-soft">No events yet.</li>}
            {data.audit.map((a: any, i: number) => (
              <li key={i} className="py-0.5"><span className="text-ink-soft">{a.at.slice(11, 19)}</span> {a.actor} {a.action} {a.ref} <span className="text-ink-soft">{a.detail}</span></li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, target }: { label: string; value: string; target: string }) {
  return (
    <div className="rounded-xl border border-rule bg-sheet p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
      <div className="mt-1 text-sm font-medium text-ok">{target}</div>
    </div>
  );
}
