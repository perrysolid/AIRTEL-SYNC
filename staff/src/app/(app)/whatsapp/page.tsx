"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Unlink } from "lucide-react";
import { send, useApi, ago } from "@/lib/api";
import { LiveDot, Loading, PageHead, WhatsAppLogo } from "@/components/ui";

interface LinkStatus {
  enabled: boolean;
  state: "off" | "starting" | "waiting" | "pairing" | "open" | "logged_out";
  number?: string;
  code?: string;
  since: string;
  error?: string;
}

const btn = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-bold disabled:opacity-40";

/** Manager: link the WhatsApp number the bot answers on. One-time; it reconnects by itself after restarts. */
export default function WhatsApp() {
  const { data, reload } = useApi<LinkStatus>("/api/staff/whatsapp", 3_000);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState<"pair" | "unlink">();
  const [error, setError] = useState("");

  const run = async (kind: "pair" | "unlink", body: unknown) => {
    setBusy(kind);
    setError("");
    const r = await send<LinkStatus>("/api/staff/whatsapp", "POST", body);
    if (!r.ok) setError(r.error);
    await reload();
    setBusy(undefined);
  };

  if (!data) return <Loading />;
  const linked = data.state === "open";
  return (
    <>
      <PageHead title="WhatsApp number" sub="The number owners message. The bot replies to everyone, around the clock, and order updates go out from it too." right={<LiveDot />} />

      {!data.enabled ? (
        <section className="card p-5 text-[15px]">
          Turned off on the backend. In Render, add <code className="rounded bg-paper px-1.5">WA_LINK=on</code> to the environment and redeploy, then come back here.
        </section>
      ) : linked ? (
        <section className="card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-ok text-white"><CheckCircle2 /></span>
            <div>
              <div className="text-lg font-extrabold">Live on +{data.number}</div>
              <div className="text-sm text-ink-soft">Connected {ago(data.since)}. Anyone who messages this number gets the bot.</div>
            </div>
          </div>
          <a href={`https://wa.me/${data.number}?text=Hi`} target="_blank" rel="noreferrer" className={`${btn} mt-5 bg-wa text-white`}><WhatsAppLogo /> Test it: say hi</a>
          <button disabled={!!busy} onClick={() => void run("unlink", { action: "unlink" })} className={`${btn} ml-2 mt-5 border border-rule bg-sheet`}>
            {busy === "unlink" ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />} Unlink
          </button>
        </section>
      ) : (
        <section className="card grid gap-5 p-5 text-[15px]">
          <ol className="grid list-decimal gap-2 pl-5">
            <li>Put the SIM in a phone, install <b>WhatsApp Business</b> and register the number there.</li>
            <li>Enter the number below and tap <b>Get code</b>.</li>
            <li>On the phone: WhatsApp → <b>Settings → Linked devices → Link a device → Link with phone number instead</b>, and type the code.</li>
          </ol>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run("pair", { number });
            }}
          >
            <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" placeholder="91 98765 43210" aria-label="WhatsApp number with country code" className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2.5 outline-none focus:border-ink" />
            <button disabled={!!busy || number.replace(/\D/g, "").length < 10} className={`${btn} bg-ink text-white`}>{busy === "pair" && <Loader2 size={16} className="animate-spin" />} Get code</button>
          </form>
          {data.state === "pairing" && data.code && (
            <div className="rounded-2xl bg-brand-soft p-5 text-center">
              <div className="text-sm text-ink-soft">Code for +{data.number}</div>
              <div className="mt-1 font-mono text-4xl font-extrabold tracking-[0.2em]">{data.code.match(/.{1,4}/g)?.join("-")}</div>
              <div className="mt-2 text-sm text-ink-soft">This page turns green once the phone accepts it. Codes expire in a few minutes; tap Get code again for a new one.</div>
            </div>
          )}
          {data.state === "logged_out" && <p className="text-sm text-ink-soft">The phone unlinked this device. Link it again above.</p>}
          {(error || data.error) && <p className="text-sm font-semibold text-brand">{error || data.error}</p>}
        </section>
      )}
    </>
  );
}
