"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PhoneCall, X } from "lucide-react";
import { useCustomer } from "./Account";

const WHEN = ["Now", "Within 2 hours", "This evening", "Tomorrow morning"] as const;

/**
 * "Request a call": a small button that follows you down the page once you're past the landing screen. It opens a
 * short form (name, mobile, when to call); the request joins the advisor hand-off queue for a person to call back.
 */
export function RequestCall({ lang }: { lang: string }) {
  const { me } = useCustomer();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState<(typeof WHEN)[number]>("Within 2 hours");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string>();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (me?.phone && !phone) setPhone(me.phone.replace(/^91/, ""));
    if (me?.name && !name) setName(me.name);
  }, [me, phone, name]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/callback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, name, when, language: lang }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDone(j.masked);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        className={`fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-brand py-2 pr-5 pl-2 text-[15px] font-extrabold text-white shadow-[0_18px_40px_-14px_var(--brand)] transition-all duration-300 hover:-translate-y-0.5 sm:right-6 sm:bottom-6 ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-brand"><PhoneCall size={16} strokeWidth={2.4} /></span>
        Request a call
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rc-title">
          <button aria-label="Close" className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="rise relative m-3 w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)]">
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full hover:bg-paper"><X size={18} /></button>
            {done ? (
              <div className="py-4 text-center">
                <CheckCircle2 size={44} className="mx-auto text-ok" />
                <h2 id="rc-title" className="mt-3 text-xl font-extrabold">We&apos;ll call you {when === "Now" ? "shortly" : when.toLowerCase()}</h2>
                <p className="mt-2 text-ink-soft">An Accel Business advisor will call {done}. They&apos;ll already know what you asked for.</p>
                <button onClick={() => { setOpen(false); setDone(undefined); }} className="mt-5 rounded-full bg-brand px-6 py-2.5 font-bold text-white">Done</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand"><PhoneCall size={20} /></div>
                <h2 id="rc-title" className="mt-3 text-xl font-extrabold">Request a call</h2>
                <p className="mt-1 text-ink-soft">Leave your number and an Accel Business advisor will call you back, in your language.</p>
                <label className="mt-5 block text-sm font-semibold" htmlFor="rc-name">Your name <span className="font-normal text-ink-soft">(optional)</span></label>
                <input id="rc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2.5" />
                <label className="mt-3 block text-sm font-semibold" htmlFor="rc-phone">Mobile number</label>
                <div className="mt-1 flex items-center rounded-xl border border-rule bg-paper">
                  <span className="pl-3 font-semibold text-ink-soft">+91</span>
                  <input id="rc-phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} inputMode="numeric" autoComplete="tel-national" required maxLength={12} placeholder="98765 43210" className="min-w-0 flex-1 bg-transparent px-2 py-2.5 outline-none" />
                </div>
                <div className="mt-3 text-sm font-semibold">When should we call?</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {WHEN.map((w) => (
                    <button type="button" key={w} onClick={() => setWhen(w)} aria-pressed={when === w} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${when === w ? "border-brand bg-brand-soft text-brand" : "border-rule hover:bg-paper"}`}>{w}</button>
                  ))}
                </div>
                {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
                <button disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 font-extrabold text-white disabled:opacity-60">
                  {busy && <Loader2 size={18} className="animate-spin" />} Call me back
                </button>
                <p className="mt-2 text-center text-xs text-ink-soft">We use your number only for this call.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
