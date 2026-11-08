"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Copy, Loader2, Phone } from "lucide-react";
import { ago, inr, send, useApi, when } from "@/lib/api";
import type { LeadDetail } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { Loading, Score, TelegramLogo, WhatsAppLogo } from "@/components/ui";
import { Summary } from "@/components/Summary";

const OUTCOMES = ["Connected", "No answer", "Busy, call back", "Wrong number", "Not interested"];
const STATUSES = [["", "Keep status"], ["contacted", "Contacted"], ["interested", "Interested"], ["quote_sent", "Quote sent"], ["won", "Won"], ["lost", "Lost"], ["dnc", "Do not call"]] as const;
const KIND_LABEL: Record<string, string> = { call: "Call", whatsapp: "WhatsApp", note: "Note", status: "Status", assign: "Reassigned" };

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const { data: l, reload } = useApi<LeadDetail>(`/api/staff/leads/${id}`, 20_000);
  if (!l) return <Loading />;

  const facts: [string, string][] = [
    ["Contact", `${l.contact}, ${l.contactRole}`],
    ["Phone", l.phone],
    ["Team", `${l.employees} people, ${l.sites} ${l.sites === 1 ? "site" : "sites"}`],
    ["Turnover", l.turnover],
    ["Internet today", `${l.internetToday}${l.providerToday && l.providerToday !== "None" ? `, ${l.providerToday}` : ""}`],
    ["Pays today", l.spendToday ? `${inr(l.spendToday)} a month` : "Not known"],
    ["Registered", [l.gstin && "GST", l.udyam && "Udyam"].filter(Boolean).join(" and ") || "No GST or Udyam"],
    ["Language", l.language],
    ["Came from", l.source],
    ["Got as far as", `${l.stage}${l.dropReason ? `, dropped: ${l.dropReason.toLowerCase()}` : ""}`],
  ];

  return (
    <div className="grid gap-5">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft size={15} /> Leads</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{l.business}</h1>
          <p className="text-ink-soft">{l.type} in {l.city} · {l.id} · {l.statusLabel}{me.role === "admin" ? ` · ${l.ownerName}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 font-extrabold text-white"><Phone size={17} /> Call</a>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold">Chance to activate</h2>
              <Score p={l.probability} band={l.band} />
            </div>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {l.reasons.map((r) => <li key={r.label} className="flex justify-between"><span>{r.label}</span><span className={r.effect > 0 ? "font-semibold text-ok" : "text-ink-soft"}>{r.effect > 0 ? "raises it" : "lowers it"}</span></li>)}
            </ul>
          </section>

          {l.chats.length > 0 && (
            <section className="card p-5">
              <h2 className="font-extrabold">Their chat with the advisor</h2>
              <p className="text-xs text-ink-soft">{ago(l.chats[0].at)} on {l.chats[0].channel}</p>
              <div className="mt-2"><Summary s={l.chats[0].summary} /></div>
            </section>
          )}

          <LogTouch id={l.id} status={l.status} onDone={reload} />

          <section className="card p-5">
            <h2 className="font-extrabold">History</h2>
            {l.activity.length ? (
              <ol className="mt-3 grid gap-3">
                {l.activity.map((a) => (
                  <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-brand" />
                    <div>
                      <div className="text-sm"><span className="font-bold">{KIND_LABEL[a.kind] ?? a.kind}{a.outcome ? `: ${a.outcome}` : ""}</span>{a.status ? <span className="text-ink-soft"> → {a.status.replace("_", " ")}</span> : null}</div>
                      {a.note && a.kind !== "assign" && <p className="text-sm">{a.note}</p>}
                      <div className="text-xs text-ink-soft">{a.staffName} · {ago(a.at)}{a.nextAt ? ` · follow up ${when(a.nextAt)}` : ""}</div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">Nobody has contacted this business yet.</p>
            )}
          </section>
        </div>

        <div className="grid content-start gap-5">
          <Outreach l={l} onSent={reload} />
          <section className="card p-5">
            <h2 className="font-extrabold">The business</h2>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {facts.map(([k, v]) => [<dt key={`${k}t`} className="text-ink-soft">{k}</dt>, <dd key={`${k}d`} className="font-semibold">{v}</dd>])}
            </dl>
            {l.interests.length > 0 && <p className="mt-3 text-sm"><span className="text-ink-soft">Asked about:</span> {l.interests.join(", ")}</p>}
          </section>
          {l.assignable.length > 0 && <Assign l={l} onDone={reload} />}
        </div>
      </div>
    </div>
  );
}

function LogTouch({ id, status, onDone }: { id: string; status: string; onDone: () => void }) {
  const [kind, setKind] = useState<"call" | "whatsapp" | "note">("call");
  const [outcome, setOutcome] = useState("");
  const [next, setNext] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const seg = (on: boolean) => `rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`;
  async function save() {
    setBusy(true);
    const r = await send(`/api/staff/leads/${id}`, "POST", { kind, outcome: kind === "call" ? outcome || undefined : undefined, status: newStatus || undefined, note, nextAt: next || undefined });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setMsg("Saved");
    setOutcome("");
    setNote("");
    setNext("");
    setNewStatus("");
    onDone();
  }
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold">Log what happened</h2>
        <div className="flex rounded-full bg-paper p-1">
          {(["call", "whatsapp", "note"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={seg(kind === k)}>{KIND_LABEL[k]}</button>)}
        </div>
      </div>
      {kind === "call" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {OUTCOMES.map((o) => <button key={o} onClick={() => setOutcome(o)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${outcome === o ? "border-brand bg-brand-soft text-brand" : "border-rule"}`}>{o}</button>)}
        </div>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What did they say?" className="mt-3 w-full rounded-xl border border-rule bg-paper px-3 py-2.5 outline-none focus:border-ink" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Follow up<input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2 font-normal" /></label>
        <label className="text-sm font-semibold">Status<select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2.5 font-normal">{STATUSES.filter(([k]) => k !== status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={busy || (kind === "call" && !outcome)} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-bold text-white disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin" />} Save</button>
        {msg && <span className="text-sm font-semibold text-ink-soft">{msg}</span>}
      </div>
    </section>
  );
}

/** The personal win-back message: opens WhatsApp or Telegram with it, and logs that it went out. */
function Outreach({ l, onSent }: { l: LeadDetail; onSent: () => void }) {
  const [copied, setCopied] = useState(false);
  // The dataset has no real numbers (the phone shown is a placeholder), so WhatsApp opens its share sheet and
  // the salesperson picks the owner's chat themselves.
  const wa = `https://wa.me/?text=${encodeURIComponent(l.outreach.message)}`;
  const logged = () => void send(`/api/staff/leads/${l.id}`, "POST", { kind: "whatsapp", note: "Sent the personal link" }).then(onSent);
  return (
    <section className="card p-5">
      <h2 className="font-extrabold">Send their personal link</h2>
      <p className="mt-1 text-sm text-ink-soft">Opens a chat with the advisor that already knows their business, in their language. No visit needed.</p>
      <p className="mt-3 rounded-xl bg-paper p-3 text-sm whitespace-pre-line">{l.outreach.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={wa} target="_blank" rel="noreferrer" onClick={logged} className="inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-4 py-2 font-bold hover:border-ink/25"><WhatsAppLogo className="h-5 w-5" /> WhatsApp</a>
        <a href={`https://t.me/share/url?url=${encodeURIComponent(l.outreach.telegram)}&text=${encodeURIComponent(l.outreach.message)}`} target="_blank" rel="noreferrer" onClick={logged} className="inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-4 py-2 font-bold hover:border-ink/25"><TelegramLogo className="h-5 w-5" /> Telegram</a>
        <button onClick={() => void navigator.clipboard.writeText(l.outreach.message).then(() => setCopied(true))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:text-ink"><Copy size={15} /> {copied ? "Copied" : "Copy"}</button>
      </div>
    </section>
  );
}

function Assign({ l, onDone }: { l: LeadDetail; onDone: () => void }) {
  const [to, setTo] = useState(l.owner);
  const [busy, setBusy] = useState(false);
  return (
    <section className="card p-5">
      <h2 className="font-extrabold">Owner</h2>
      <div className="mt-3 flex gap-2">
        <select value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-rule bg-sheet px-3 py-2.5">
          {l.assignable.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role === "partner" ? "partner" : "sales"}{s.region ? `, ${s.region}` : ""})</option>)}
        </select>
        <button disabled={busy || to === l.owner} onClick={async () => { setBusy(true); await send(`/api/staff/leads/${l.id}/assign`, "POST", { to }); setBusy(false); onDone(); }} className="rounded-full bg-ink px-4 py-2 font-bold text-white disabled:opacity-40">Move</button>
      </div>
    </section>
  );
}
