"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ImageUp, Loader2, Phone, Send, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { PageHero, PageShell } from "@/components/SiteNav";
import type { ScamResult } from "@/lib/scam";

const EXAMPLES: [string, string][] = [
  ["Fake KYC SMS", "Dear customer, your Airtel SIM will be blocked today. Update KYC immediately at http://airtel-kyc-update.xyz/verify or call 9876543210"],
  ["Fake UPI screenshot", "Payment successful Rs 2,400 paid to Raju Kirana UPI Ref 442198 will reflect in your account shortly. Please give the goods now."],
  ["“Sent by mistake”", "Sorry bhai I sent Rs 5000 to your number by mistake, please send it back urgently"],
  ["Bill threat + APK", "Your electricity will be cut tonight. Download app http://bijli-bill.top/pay.apk and pay Rs 10 now"],
  ["Digital arrest", "This is CBI officer. You are under digital arrest. Install AnyDesk now and do not tell anyone"],
  ["Hindi KYC", "आपका खाता बंद हो जाएगा। तुरंत केवाईसी अपडेट करें और ओटीपी बताओ"],
  ["A normal message", "Hi, are we meeting at 5 pm for the supplier visit tomorrow?"],
];
const TONE = {
  scam: { Icon: ShieldAlert, box: "border-bad bg-bad/10", text: "text-bad", bar: "bg-bad" },
  suspicious: { Icon: ShieldQuestion, box: "border-warn bg-warn/15", text: "text-warn", bar: "bg-warn" },
  clear: { Icon: ShieldCheck, box: "border-ok bg-ok/10", text: "text-ok", bar: "bg-ok" },
} as const;
const DOT = { high: "bg-bad", med: "bg-warn", info: "bg-signal" } as const;

export default function ShieldPage() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [res, setRes] = useState<ScamResult>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function check(t = text, l = lang) {
    if (!t.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/scam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, lang: l }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not check that right now.");
      else setRes(j);
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File) {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("lang", lang);
      const r = await fetch("/api/scam/image", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "I could not read that picture.");
      else {
        setRes(j);
        if (j.ocrText) setText(j.ocrText);
      }
    } finally {
      setBusy(false);
    }
  }
  const tone = res ? TONE[res.verdict] : undefined;

  return (
    <PageShell>
      <PageHero eyebrow="SYNC Scam Shield · free for everyone" title="Got a message that feels wrong? Check it here." sub="Paste a message or link, or upload a screenshot. I'll tell you what looks suspicious, in plain words, and exactly what to do next. Your text is analysed in memory and never stored." />

      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="msg" className="font-semibold">Paste the message, link or number</label>
          <div role="group" aria-label="Answer language" className="flex rounded-full border border-rule p-0.5 text-sm font-semibold">
            {(["en", "hi"] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); if (res && text) void check(text, l); }} className={`rounded-full px-3 py-1 ${lang === l ? "bg-brand text-white" : "text-ink-soft"}`}>{l === "en" ? "English" : "हिन्दी"}</button>
            ))}
          </div>
        </div>
        <textarea id="msg" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. “Your SIM will be blocked. Update KYC at http://…”" className="mt-2 w-full resize-y rounded-xl border border-rule bg-paper p-3" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={!text.trim() || busy} onClick={() => check()} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Check it
          </button>
          <button disabled={busy} onClick={() => file.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-rule bg-sheet px-5 py-3 font-semibold">
            <ImageUp size={18} /> Upload a screenshot
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <div className="mt-4 text-sm text-ink-soft">Try an example:</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {EXAMPLES.map(([k, v]) => (
            <button key={k} onClick={() => { setText(v); void check(v); }} className="rounded-full border border-rule bg-paper px-3 py-1.5 text-sm font-semibold hover:border-ink-soft">{k}</button>
          ))}
        </div>
        {err && <p role="alert" className="mt-3 font-medium text-bad">{err}</p>}
      </div>

      {res && tone && (
        <div className="mt-6 space-y-4" aria-live="polite">
          <div className={`rise flex items-start gap-4 rounded-2xl border-2 p-5 ${tone.box}`}>
            <tone.Icon size={44} className={`shrink-0 ${tone.text}`} />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-extrabold">{res.label}</h2>
              <p className="font-semibold">{res.advice}</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`Risk ${res.score} out of 100`}>
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${res.score}%` }} />
              </div>
              <div className="mt-1 text-sm text-ink-soft">Risk score {res.score}/100</div>
            </div>
          </div>

          {res.reasons.length > 0 && (
            <div className="card p-5">
              <h3 className="text-lg font-bold">Why I think so</h3>
              <ul className="mt-2 divide-y divide-rule">
                {res.reasons.map((r, i) => (
                  <li key={i} className="flex gap-3 py-2.5"><span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[r.severity]}`} /><span>{r.text}</span></li>
                ))}
              </ul>
              {res.links.length > 0 && (
                <div className="mt-3 text-sm text-ink-soft">Links found: {res.links.map((l) => <code key={l.url} className="mr-2 rounded bg-paper px-2 py-0.5 font-mono">{l.host}</code>)}</div>
              )}
            </div>
          )}

          <div className="card p-5">
            <h3 className="text-lg font-bold">What to do now</h3>
            <ol className="mt-2 space-y-2">
              {res.actions.map((a, i) => (
                <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span><span>{a}</span></li>
              ))}
            </ol>
            {res.verdict !== "clear" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="https://sancharsaathi.gov.in" target="_blank" rel="noreferrer" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">Report on Chakshu</a>
                <a href="tel:1930" className="inline-flex items-center gap-1.5 rounded-xl border border-rule bg-sheet px-4 py-2.5 text-sm font-semibold"><Phone size={14} /> Lost money? Call 1930</a>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card mt-6 p-5">
        <div className="font-bold">Prefer WhatsApp or Telegram?</div>
        <p className="mt-1 text-ink-soft">Forward any suspicious message or link to the SYNC bot and get the same answer in your chat, even without typing a command.</p>
        <Link href="/whatsapp" className="mt-3 inline-block rounded-xl border border-rule bg-sheet px-4 py-2.5 text-sm font-semibold">Try it on WhatsApp</Link>
      </div>
      <p className="mt-4 text-sm text-ink-soft">Scam Shield looks for known red flags. It cannot prove a message is safe or confirm that a payment arrived. When in doubt, check inside your bank/UPI app and never share an OTP.</p>
    </PageShell>
  );
}
