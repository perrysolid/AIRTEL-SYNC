"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, Siren, Store, TriangleAlert, Zap } from "lucide-react";
import { NetworkOptions } from "@/components/NetworkResult";
import { inr } from "@/lib/format";
import type { BranchPreview } from "@/lib/branch";
import type { ContinuityView } from "@/lib/continuity";
import type { PublicOrder } from "@/lib/order-view";
import type { Slot } from "@/lib/scheduler";

/* Panels shown in the tracker tabs: installation slot, service health & backup, new branch. */

async function call<T>(url: string, body?: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const r = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  return { ok: r.ok, data: await r.json() };
}
const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

// ---------------------------------------------------------------------------------------------- slot
export function SlotPanel({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const [slots, setSlots] = useState<Slot[]>();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  useEffect(() => {
    void call<Slot[]>(`/api/order/${order.id}/slots`).then((r) => setSlots(r.data as unknown as Slot[]));
  }, [order.id, order.slot?.id]);

  async function pick(id: string) {
    setBusy(id);
    setMsg(undefined);
    const r = await call<PublicOrder>(`/api/order/${order.id}/schedule`, { slotId: id });
    setBusy("");
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? "Could not book that slot." });
    onUpdate(r.data as PublicOrder);
    setMsg({ ok: true, text: order.slot ? "Rescheduled ✓" : "Installation booked ✓" });
  }
  const left = Math.max(0, 2 - order.reschedules);
  const days = [...new Set((slots ?? []).map((s) => s.date))];

  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2 text-xl font-extrabold"><CalendarClock size={22} /> Installation slot</h3>
      {order.slot ? (
        <div className="mt-3 flex gap-3 rounded-xl border-2 border-ok bg-ok/10 p-3"><Check className="shrink-0 text-ok" /><div><b>Booked: {order.slot.label}</b><div className="text-sm">A technician arrives in that window and you get a reminder the evening before. Free reschedules left: {left}.</div></div></div>
      ) : (
        <p className="mt-1 text-ink-soft">Choose a time that suits your shop. No phone calls to fix a date.</p>
      )}
      {!slots ? (
        <div className="mt-4 grid place-items-center py-6 text-ink-soft"><Loader2 className="animate-spin" /></div>
      ) : slots.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-rule p-4 text-ink-soft">Nothing to schedule: your SIMs and cloud apps are activated remotely, with no technician visit.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {days.map((d) => (
            <div key={d}>
              <div className="text-sm font-semibold text-ink-soft">{fmtDay(d)}</div>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {slots.filter((s) => s.date === d).map((s) => (
                  <button key={s.id} disabled={!!busy || (!!order.slot && left === 0 && order.slot.id !== s.id)} onClick={() => pick(s.id)} aria-pressed={order.slot?.id === s.id} className={`rounded-xl border px-2 py-2.5 text-sm font-semibold disabled:opacity-40 ${order.slot?.id === s.id ? "border-ok bg-ok/10" : "border-rule bg-sheet hover:border-ink-soft"}`}>
                    {busy === s.id ? <Loader2 size={14} className="mx-auto animate-spin" /> : s.window}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p role="status" className={`mt-3 font-medium ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
    </section>
  );
}

// -------------------------------------------------------------------------------------------- health
export function HealthPanel({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const [c, setC] = useState<ContinuityView>();
  const [sph, setSph] = useState<number>();
  const [dep, setDep] = useState(60);
  const [hrs, setHrs] = useState(4);
  const [note, setNote] = useState("");

  const pull = useCallback(async () => {
    const qs = new URLSearchParams({ dependent_pct: String(dep), hours: String(hrs) });
    if (sph) qs.set("sales_per_hour", String(sph));
    const r = await call<ContinuityView>(`/api/order/${order.id}/continuity?${qs}`);
    setC(r.data as ContinuityView);
    if (sph === undefined) setSph((r.data as ContinuityView).salesPerHour);
  }, [order.id, dep, hrs, sph]);
  useEffect(() => {
    void pull();
  }, [pull, order.outageActive, order.hasFailover]);

  const refreshOrder = async () => onUpdate((await call<PublicOrder>(`/api/order/${order.id}`)).data as PublicOrder);
  async function outage(action: "start" | "end") {
    await call(`/api/order/${order.id}/outage`, { action });
    await refreshOrder();
    setNote(action === "start" ? "Outage simulated. See the WhatsApp update below." : "Main link restored.");
  }
  async function failover() {
    const r = await call<PublicOrder>(`/api/order/${order.id}/failover`, {});
    if (!r.ok) return setNote(r.data.error ?? "Could not add backup.");
    onUpdate(r.data as PublicOrder);
    setNote("Backup 4G/5G Failover added to your bundle ✓");
  }
  if (!c) return <div className="grid place-items-center py-10 text-ink-soft"><Loader2 className="animate-spin" /></div>;

  const down = c.outageActive && !c.hasFailover;
  const status = !c.outageActive ? "Online" : c.hasFailover ? "Online on backup" : "Offline";
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xl font-extrabold"><span className={`h-3 w-3 rounded-full ${down ? "bg-bad" : "bg-signal"}`} /> {status}</h3>
          <div className="flex gap-2">
            <button disabled={c.outageActive} onClick={() => outage("start")} className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sheet px-3 py-2 text-sm font-semibold disabled:opacity-40"><Zap size={15} /> Simulate an outage</button>
            <button disabled={!c.outageActive} onClick={() => outage("end")} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Restore link</button>
          </div>
        </div>
        {c.outageActive && (
          <div className={`mt-3 flex gap-3 rounded-xl border-2 p-3 ${c.hasFailover ? "border-ok bg-ok/10" : "border-bad bg-bad/10"}`}>
            <span aria-hidden>{c.hasFailover ? "🛟" : "🚨"}</span>
            <p>{c.hasFailover ? <><b>Backup took over in {c.incidents[0]?.switchSeconds} seconds.</b> Billing and payments are still working while we fix the main link.</> : <><b>Your internet is down.</b> Ticket {c.incidents[0]?.ticketId} was raised automatically and a technician is assigned (fix within 4 hours).</>}</p>
          </div>
        )}
        <p className="mt-3 text-sm text-ink-soft">Outage events are simulated for the demo. In production, health comes from router and network telemetry, and the same alerts go to your chat.</p>
        {order.tickets.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-sm font-bold"><Siren size={14} /> Tickets &amp; SLA</div>
            <ul className="mt-1 divide-y divide-rule text-sm">
              {order.tickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2"><span><span className="font-mono">{t.id}</span> · {t.kind.replace("_", " ")} · {t.assignedTo}</span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.status === "Resolved" ? "bg-ok/15 text-ok" : "bg-warn/25 text-warn"}`}>{t.status} · SLA {t.slaHours}h</span></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h4 className="text-lg font-extrabold">🛟 Is a backup link worth it for you?</h4>
        <p className="text-sm text-ink-soft">Move the sliders to match your shop. This is a simple estimate, not a promise.</p>
        <Slider id="sph" label={`Sales per hour: ${inr(sph ?? c.salesPerHour)}`} min={200} max={20000} step={100} value={sph ?? c.salesPerHour} onChange={setSph} />
        <Slider id="dep" label={`Share of sales that needs the internet (UPI, billing, orders): ${dep}%`} min={10} max={100} step={5} value={dep} onChange={setDep} />
        <Slider id="hrs" label={`Hours offline per month: ${hrs}`} min={0} max={20} step={0.5} value={hrs} onChange={setHrs} />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Estimated loss / month" value={inr(c.estLossMonth)} tone="text-bad" />
          <Stat label="Backup costs / month" value={inr(c.failoverMonthlyWithGst)} sub="incl. GST" />
          <Stat label="Pays for itself if offline" value={`${c.breakevenHoursMonth ?? "–"} h`} sub="per month" />
        </div>
        {c.hasFailover ? (
          <p className="mt-3 flex gap-2 rounded-xl bg-ok/10 p-3"><Check className="shrink-0 text-ok" /> Backup 4G/5G Failover is already in your bundle.</p>
        ) : c.canAddFailover ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-warn/15 p-3">
            <p className="min-w-0 flex-1">{c.worthIt ? "At these numbers, one bad month of outages costs more than backup would." : "At these numbers backup is optional, but it protects you in a bad month."}</p>
            <button onClick={failover} className="rounded-xl bg-brand px-4 py-2.5 font-extrabold text-white">Add Backup 4G/5G</button>
          </div>
        ) : (
          <p className="mt-3 flex gap-2 rounded-xl bg-signal/10 p-3 text-sm"><TriangleAlert size={16} className="mt-0.5 shrink-0" /> Backup failover needs a fixed-line plan (fibre or leased line). On 5G AirFiber, ask your partner about adding a fixed line.</p>
        )}
        <p className="mt-2 text-xs text-ink-soft">{c.assumptions}</p>
      </section>
      {note && <p role="status" className="text-center text-sm font-semibold text-ink-soft">{note}</p>}
    </div>
  );
}

function Slider({ id, label, ...p }: { id: string; label: string; min: number; max: number; step: number; value: number; onChange: (n: number) => void }) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input id={id} type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--brand-deep)]" />
    </div>
  );
}
function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-rule bg-paper p-2.5">
      <div className="text-[11px] leading-tight text-ink-soft">{label}</div>
      <div className={`mt-1 text-lg font-extrabold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-soft">{sub}</div>}
    </div>
  );
}

// ------------------------------------------------------------------------------------------ branch
const BRANCH_CITIES = ["Nashik", "Pune", "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kochi", "Jaipur", "Surat", "Nagpur", "Indore", "Lucknow", "Kolkata", "Ahmedabad"];

export function BranchPanel({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const [f, setF] = useState({ name: "", city: "Nashik", pincode: "422001" });
  const [pv, setPv] = useState<BranchPreview>();
  const [done, setDone] = useState<PublicOrder>();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const body = (confirm: boolean) => ({ name: f.name.trim() || `${f.city} branch`, city: f.city, pincode: f.pincode, confirm });

  async function preview() {
    setBusy(true);
    setErr("");
    setDone(undefined);
    const r = await call<BranchPreview>(`/api/order/${order.id}/branch`, body(false));
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Could not preview this branch.");
    setPv(r.data as BranchPreview);
  }
  async function create() {
    setBusy(true);
    const r = await call<{ order: PublicOrder }>(`/api/order/${order.id}/branch`, body(true));
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Could not create the branch.");
    setDone((r.data as { order: PublicOrder }).order);
    setPv(undefined);
    onUpdate((await call<PublicOrder>(`/api/order/${order.id}`)).data as PublicOrder);
  }

  return (
    <section className="card p-5">
      <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">Branch-in-a-Box</span>
      <h3 className="mt-2 flex items-center gap-2 text-xl font-extrabold"><Store size={22} /> Open a new location in one tap</h3>
      <p className="mt-1 text-ink-soft">We copy your current setup to the new address, reuse your verified KYC, check the network there and start activation. You only upload the new address proof.</p>
      {order.branches.length > 0 && (
        <p className="mt-2 text-sm">Your branches: {order.branches.map((b) => <Link key={b.id} href={`/order/${b.id}`} className="mr-2 font-semibold underline underline-offset-2">{b.name} ({b.id})</Link>)}</p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <label><span className="text-sm font-semibold">Branch name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Gangapur Road" className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2.5" /></label>
        <label><span className="text-sm font-semibold">City</span><select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2.5">{BRANCH_CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span className="text-sm font-semibold">Pincode</span><input value={f.pincode} inputMode="numeric" maxLength={6} onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, "") })} className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2.5 font-mono" /></label>
      </div>
      <button disabled={f.pincode.length !== 6 || busy} onClick={preview} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} Preview</button>
      {err && <p role="alert" className="mt-3 font-medium text-bad">{err}</p>}

      {pv && (
        <div className="mt-5">
          <h4 className="font-extrabold">Copied from your head office</h4>
          <ul className="mt-1 divide-y divide-rule text-[15px]">
            {pv.quote.lines.filter((l) => l.active).map((l) => <li key={l.productId} className="flex justify-between py-1.5"><span>{l.name} × {l.qty}</span><span className="tabular-nums">{inr(l.monthly)}</span></li>)}
          </ul>
          <div className="mt-2 flex justify-between border-t-2 border-brand pt-2 font-extrabold"><span>New branch / month (incl. GST)</span><span className="tabular-nums">{inr(pv.quote.monthlyWithGst)}</span></div>
          <div className="text-sm text-ink-soft">Your total after adding it: {inr(pv.totalAfter)}/month · one bill</div>
          <div className="mt-4"><NetworkOptions r={pv.network} /></div>
          {pv.removed.length > 0 && <p className="mt-3 flex gap-2 rounded-xl bg-warn/15 p-3 text-sm"><TriangleAlert size={16} className="mt-0.5 shrink-0" /> Not copied because it needs a fixed line: {pv.removed.join(", ")}.</p>}
          <p className="mt-3 flex gap-2 rounded-xl bg-ok/10 p-3 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-ok" /><span><b>KYC reused.</b> Only needed: {pv.needs.join(", ")}.</span></p>
          <button disabled={busy} onClick={create} className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-lg font-extrabold text-white disabled:opacity-60">Create this branch</button>
        </div>
      )}
      {done && (
        <div className="mt-4 flex gap-3 rounded-xl border-2 border-ok bg-ok/10 p-3">
          <span aria-hidden>🏪</span>
          <div><b>Branch created: order {done.id}</b><div className="text-sm">Activation has started. <Link href={`/order/${done.id}`} className="font-bold underline underline-offset-2">Open the branch order →</Link></div></div>
        </div>
      )}
    </section>
  );
}
