"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Check, Globe, Loader2, Send } from "lucide-react";
import { ago, inr, send, stageTone, useApi } from "@/lib/api";
import type { OrderDetail } from "@/lib/types";
import { LiveDot, Loading, TelegramLogo, WhatsAppLogo } from "@/components/ui";
import { Summary } from "@/components/Summary";
import { useMe } from "@/components/Shell";

const REACH_ICON = { whatsapp: <WhatsAppLogo className="h-5 w-5" />, telegram: <TelegramLogo className="h-5 w-5" />, web: <Globe size={18} className="text-ink-soft" /> };
const REACH_NAME = { whatsapp: "WhatsApp", telegram: "Telegram", web: "Tracker" };

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const { data: o, reload } = useApi<OrderDetail>(`/api/staff/orders/${id}`, 8_000);
  const [fresh, setFresh] = useState<string>();
  if (!o) return <Loading />;

  async function act(body: Record<string, string>) {
    const r = await send<OrderDetail>(`/api/staff/orders/${id}`, "POST", body);
    if (!r.ok) return r.error;
    setFresh(r.data.updates[0]?.at);
    await reload();
  }

  return (
    <div className="grid gap-5">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft size={15} /> Orders</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{o.business}</h1>
          <p className="text-ink-soft">{o.id}{o.contact ? ` · ${o.contact}` : ""}{o.phone ? ` · ${o.phone}` : ""}{o.city ? ` · ${o.city}` : ""}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-bold ${stageTone(o.stage)}`}>{o.stage}</span>
      </header>

      <ol className="card grid grid-cols-5 gap-1 p-4">
        {o.steps.map((s) => (
          <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
            <span className={`grid h-8 w-8 place-items-center rounded-full ${s.done ? "bg-ok text-white" : "border-2 border-rule text-ink-soft"}`}>{s.done ? <Check size={16} strokeWidth={3} /> : null}</span>
            <span className={`text-xs leading-tight ${s.done ? "font-bold" : "text-ink-soft"}`}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {me.role !== "admin" && <Actions o={o} act={act} />}
          {o.tracks.length > 0 && (
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold">Installation</h2>
                <span className="text-sm text-ink-soft">{o.activating ? `Day ${o.clockDay} of ${o.liveDay}` : o.clockDay >= o.liveDay ? "All live" : "Starts after payment"}</span>
              </div>
              <div className="mt-3 grid gap-4">
                {o.tracks.map((t) => (
                  <div key={t.key}>
                    <div className="text-sm font-bold">{t.title}</div>
                    <ol className="mt-1.5 grid gap-1">
                      {t.steps.map((s) => (
                        <li key={s.label} className="flex items-center gap-2 text-sm">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.status === "done" ? "bg-ok" : s.status === "active" ? "bg-marigold" : "bg-rule"}`} />
                          <span className={s.status === "upcoming" ? "text-ink-soft" : ""}>{s.label}</span>
                          <span className="ml-auto text-xs text-ink-soft">day {s.day}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="card p-5">
            <h2 className="font-extrabold">Plan · {inr(o.monthlyWithGst)} a month incl. GST</h2>
            <ul className="mt-2 grid gap-1 text-sm">{o.lines.map((l) => <li key={l.name} className="flex justify-between"><span>{l.qty > 1 ? `${l.qty} × ` : ""}{l.name}</span><span className="tabular text-ink-soft">{inr(l.monthly)}</span></li>)}</ul>
            {o.kyc && <p className="mt-3 text-sm"><span className="font-semibold">Verification:</span> {o.kyc.summary}{o.kyc.issues.length ? ` Issues: ${o.kyc.issues.join(", ")}.` : ""}</p>}
          </section>
        </div>

        <div className="grid content-start gap-5">
          {o.chat && (
            <section className="card p-5">
              <h2 className="font-extrabold">What happened in the chat</h2>
              <div className="mt-2"><Summary s={o.chat} /></div>
            </section>
          )}
          <section className="card p-5">
            <h2 className="font-extrabold">Where the owner gets updates</h2>
            <ul className="mt-3 grid gap-2">
              {o.reach.map((r) => <li key={r.channel + r.note} className="flex items-center gap-3 text-sm">{REACH_ICON[r.channel]}<span className="font-semibold">{REACH_NAME[r.channel]}</span><span className="text-ink-soft">{r.note}</span></li>)}
            </ul>
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between"><h2 className="font-extrabold">Updates sent</h2><LiveDot /></div>
            <ol className="mt-3 grid gap-3">
              {o.updates.map((u, i) => (
                <li key={`${u.at}${i}`} className={`rounded-xl px-3 py-2 ${u.at === fresh && i === 0 ? "fresh" : ""}`}>
                  <p className="text-sm whitespace-pre-line">{u.text}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{ago(u.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

/** What staff can do to an order. Each action is sent to the owner on every channel above, automatically. */
function Actions({ o, act }: { o: OrderDetail; act: (b: Record<string, string>) => Promise<string | undefined> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const run = async (key: string, body: Record<string, string>) => {
    setBusy(key);
    setErr("");
    const e = await act(body);
    setBusy("");
    if (e) setErr(e);
    else if (key === "message") setText("");
  };
  const btn = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-bold disabled:opacity-40";
  return (
    <section className="card p-5">
      <h2 className="font-extrabold">Update the owner</h2>
      <p className="mt-1 text-sm text-ink-soft">They get it on WhatsApp, Telegram and the tracker the moment you press it.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {o.activating && (
          <button disabled={!!busy} onClick={() => void run("day", { action: "next_day" })} className={`${btn} bg-ink text-white`}>{busy === "day" && <Loader2 size={16} className="animate-spin" />} Mark today&apos;s installation work done</button>
        )}
        {o.hasFibre && !o.live && (
          <button disabled={!!busy} onClick={() => void run("fibre", { action: "fibre_not_feasible" })} className={`${btn} border border-rule bg-sheet`}>{busy === "fibre" && <Loader2 size={16} className="animate-spin" />} No fibre here: switch to AirFiber</button>
        )}
      </div>
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void run("message", { action: "message", text }); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="E.g. Our technician Ravi will reach your shop at 11 am tomorrow." className="w-full rounded-xl border border-rule bg-paper px-3 py-2.5 outline-none focus:border-ink" />
        <button disabled={!!busy || text.trim().length < 3} className={`${btn} mt-2 bg-brand text-white`}>{busy === "message" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send to owner</button>
      </form>
      {err && <p className="mt-2 text-sm font-semibold text-brand">{err}</p>}
    </section>
  );
}
