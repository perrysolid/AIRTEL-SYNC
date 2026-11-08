"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { CheckCircle2, FileText, Mic } from "lucide-react";
import { Pipeline } from "@/components/motion/Pipeline";

const STAGES = [
  { key: "talk", label: "Talk", title: "Say it in your language", text: "Voice or chat, on the web, WhatsApp or Telegram. The advisor asks four questions, not forty." },
  { key: "plan", label: "Plan", title: "See one monthly price", text: "Every product with the reason it's there. Switch add-ons off yourself — no sales call." },
  { key: "verify", label: "Verify", title: "Verified in 2 minutes", text: "Photograph your GST and Udyam certificates. We read them and check the government registry." },
  { key: "sign", label: "Sign", title: "Sign with an OTP", text: "One page in plain words, signed with your Aadhaar-linked mobile. No printing, no courier." },
  { key: "pay", label: "Pay", title: "Pay by UPI AutoPay", text: "First month today, future bills never bounce. Cancel the mandate from your UPI app any time." },
  { key: "live", label: "Live", title: "Switched on, step by step", text: "SIMs today, apps tomorrow, fibre in days. Every step arrives on WhatsApp, so nobody has to call." },
];

const STEP_MS = 2800;

/** Auto-plays the whole order pipeline once it scrolls into view; tap a stop to jump. */
export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!inView || paused || reduce) return;
    const t = setTimeout(() => setI((k) => (k + 1) % STAGES.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, inView, paused, reduce]);

  const s = STAGES[i];
  return (
    <section aria-labelledby="journey" className="bg-sheet">
      <div ref={ref} className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
        <div className="max-w-2xl">
          <h2 id="journey" className="text-4xl font-extrabold sm:text-5xl">From hello to live, without a single follow-up call</h2>
          <p className="mt-4 text-lg text-ink-soft">Today this takes a field visit, three calls and two weeks. Here it&apos;s one sitting on your phone.</p>
        </div>

        <div className="mt-12" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <Pipeline steps={STAGES.map((x, k) => ({ key: x.key, label: x.label, done: k < i }))} active={i} onPick={setI} />

          <div className="mt-10 grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <AnimatePresence mode="wait">
              <motion.div key={s.key} initial={reduce ? false : { opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.35 }}>
                <div className="text-sm font-semibold text-brand">Step {i + 1} of {STAGES.length}</div>
                <h3 className="mt-1 text-3xl font-extrabold">{s.title}</h3>
                <p className="mt-3 max-w-md text-lg text-ink-soft">{s.text}</p>
                <div className="mt-6 h-1 max-w-xs overflow-hidden rounded-full bg-rule">
                  {!reduce && <motion.div key={`${s.key}-${paused}`} className="h-full bg-brand" initial={{ width: 0 }} animate={{ width: paused ? 0 : "100%" }} transition={{ duration: STEP_MS / 1000, ease: "linear" }} />}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="relative h-[340px] overflow-hidden rounded-[28px] bg-paper ring-1 ring-rule">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(30rem_18rem_at_80%_120%,rgb(228_0_43/0.12),transparent_70%)]" />
              <AnimatePresence mode="wait">
                <motion.div key={s.key} className="absolute inset-0 grid place-items-center p-6" initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -8 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                  <Preview stage={s.key} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const rise = (d: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.35 } });

function Preview({ stage }: { stage: string }) {
  if (stage === "talk")
    return (
      <div className="w-full max-w-sm space-y-2.5">
        <motion.div {...rise(0.1)} className="ml-auto flex w-fit items-center gap-2 rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-white">
          <Mic size={16} /> मेरी किराना दुकान है, जयपुर में, 2 लोग
        </motion.div>
        <motion.div {...rise(0.7)} className="w-fit rounded-2xl rounded-bl-md bg-white px-4 py-2.5 shadow-[var(--shadow-card)]">
          बढ़िया! 🛒 UPI बिलिंग और CCTV भी चाहिए?
        </motion.div>
        <motion.div {...rise(1.3)} className="flex gap-2">
          {["💳 बिलिंग", "📹 CCTV", "📶 इंटरनेट"].map((c) => (
            <span key={c} className="rounded-full border border-rule bg-white px-3 py-1 text-sm font-semibold">{c}</span>
          ))}
        </motion.div>
        <motion.div {...rise(1.9)} className="flex w-fit gap-1 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          {[0, 1, 2].map((k) => (
            <motion.span key={k} className="h-2 w-2 rounded-full bg-ink-soft" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: k * 0.2 }} />
          ))}
        </motion.div>
      </div>
    );
  if (stage === "plan") {
    const lines = [["📶 Biz Fibre 100", "₹999"], ["📱 2 business SIMs", "₹598"], ["💳 POS & UPI billing", "₹599"], ["📹 2 cloud cameras", "₹398"]];
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[var(--shadow-lift)]">
        <div className="text-sm text-ink-soft">Sharma Kirana, Jaipur</div>
        <ul className="mt-3 space-y-2">
          {lines.map(([a, b], k) => (
            <motion.li key={a} {...rise(0.15 + k * 0.25)} className="flex justify-between">
              <span>{a}</span>
              <span className="tabular-nums font-semibold">{b}</span>
            </motion.li>
          ))}
        </ul>
        <motion.div {...rise(1.3)} className="mt-4 flex items-baseline justify-between border-t border-rule pt-3">
          <span className="font-semibold">Per month incl. GST</span>
          <span className="text-2xl font-extrabold tabular-nums text-brand">₹2,908</span>
        </motion.div>
      </div>
    );
  }
  if (stage === "verify")
    return (
      <div className="relative w-full max-w-xs">
        <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-[var(--shadow-lift)]">
          <div className="flex items-center gap-2 font-semibold"><FileText size={18} /> GST certificate</div>
          {[80, 64, 72, 48].map((w, k) => <div key={k} className="mt-3 h-2.5 rounded bg-rule" style={{ width: `${w}%` }} />)}
          <motion.div className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-signal/25 to-transparent" initial={{ top: "-20%" }} animate={{ top: "110%" }} transition={{ duration: 1.2, ease: "easeInOut" }} />
        </div>
        <motion.div className="absolute -right-3 -bottom-4 text-ok" initial={{ opacity: 0, scale: 1.9, rotate: -14 }} animate={{ opacity: 1, scale: 1, rotate: -6 }} transition={{ delay: 1.3, type: "spring", stiffness: 300, damping: 14 }}>
          <span className="stamp bg-white/80">VERIFIED</span>
        </motion.div>
      </div>
    );
  if (stage === "sign")
    return (
      <div className="text-center">
        <div className="text-ink-soft">OTP sent to ●●●●●● 4821</div>
        <div className="mt-4 flex gap-2">
          {"482913".split("").map((d, k) => (
            <motion.span key={k} className="grid h-14 w-11 place-items-center rounded-xl bg-white text-2xl font-bold shadow-[var(--shadow-card)] ring-1 ring-rule" initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + k * 0.18 }}>
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + k * 0.18 }}>{d}</motion.span>
            </motion.span>
          ))}
        </div>
        <motion.div {...rise(1.5)} className="mt-5 inline-flex items-center gap-2 font-semibold text-ok"><CheckCircle2 size={20} /> Agreement signed</motion.div>
      </div>
    );
  if (stage === "pay")
    return (
      <div className="text-center">
        <div className="relative mx-auto grid h-28 w-28 place-items-center">
          <motion.span className="absolute inset-0 rounded-full bg-signal/20" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.4], opacity: [0.8, 0] }} transition={{ delay: 1, duration: 1.1 }} />
          <motion.span className="grid h-24 w-24 place-items-center rounded-full bg-signal text-white" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 14 }}>
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12.5 10 17 19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.2, duration: 0.4 }} />
            </svg>
          </motion.span>
        </div>
        <motion.div {...rise(0.2)} className="mt-4 text-4xl font-extrabold tabular-nums">₹2,908</motion.div>
        <motion.div {...rise(1.5)} className="mt-1 text-ink-soft">Paid with UPI AutoPay</motion.div>
      </div>
    );
  const live = ["📱 Business SIMs", "💳 POS & billing", "📹 Cloud CCTV", "📶 Biz Fibre 100"];
  return (
    <div className="w-full max-w-sm space-y-2">
      {live.map((x, k) => (
        <motion.div key={x} {...rise(0.15 + k * 0.4)} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <span className="font-semibold">{x}</span>
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${k < 3 ? "text-ok" : "text-marigold-deep"}`}>
            <span className={`h-2 w-2 rounded-full ${k < 3 ? "live-dot bg-signal" : "bg-marigold"}`} /> {k < 3 ? "Live" : "Day 3"}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
