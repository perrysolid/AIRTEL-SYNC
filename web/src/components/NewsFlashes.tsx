"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Link2, Radar, ShieldCheck, Store } from "lucide-react";
import { LogoMark } from "./Brand";
import { Reveal } from "./Reveal";

/** Platform news. Every story describes something this prototype really does; figures come from the case data. */
const NEWS: { date: string; read: string; tag: string; icon: typeof ShieldCheck; tone: string; title: string; text: string; href: string }[] = [
  {
    date: "6 Nov 2026",
    read: "2 min read",
    tag: "Safety",
    icon: ShieldCheck,
    tone: "from-[#2b0a12] via-[#7a0016] to-[#e40000]",
    title: "Scam Shield now reads screenshots and forwarded links",
    text: "Forward a fake KYC message or a 'payment received' screenshot and get a verdict, the red flags and what to do next. Chakshu and the 1930 cybercrime helpline are one tap away, in English and Hindi.",
    href: "/shield",
  },
  {
    date: "2 Nov 2026",
    read: "2 min read",
    tag: "Network",
    icon: Radar,
    tone: "from-[#06122b] via-[#0b2f6b] to-[#1f6fd1]",
    title: "No fibre on your street? Plans now switch to 5G AirFiber",
    text: "The Network Reality Check reads your pincode before you pay, and the quote re-prices itself onto AirFiber when fibre can't reach you. No more orders cancelled at the installation visit.",
    href: "/network",
  },
  {
    date: "28 Oct 2026",
    read: "3 min read",
    tag: "Growth",
    icon: Store,
    tone: "from-[#1d1203] via-[#7a4a00] to-[#f2a900]",
    title: "Opening a second shop now takes one tap",
    text: "Branch-in-a-Box copies your head-office setup to a new address, checks the network there and reuses your KYC and agreement. Only the new address proof is needed.",
    href: "/solutions",
  },
  {
    date: "21 Oct 2026",
    read: "3 min read",
    tag: "Reach",
    icon: Link2,
    tone: "from-[#04170f] via-[#0b5a3a] to-[#12a05e]",
    title: "2,017 businesses we lost get a personal link back in",
    text: "1,632 owners were never reached and 385 dropped at a slow quote. Each now gets a link that opens the chat with their details already filled in, in their own language.",
    href: "/how-it-works",
  },
];

const EVERY = 5200;

/**
 * "Accel Newsroom": one wide horizontal news card at a time (picture left, story right) that flashes to the next
 * story every few seconds, with a progress bar and a row of headline tabs to jump between them. Hover or focus
 * pauses it; reduced motion keeps it still.
 */
export function NewsFlashes() {
  const [k, setK] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const [round, setRound] = useState(0); // restarts the progress bar after a pause

  useEffect(() => setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => {
    if (paused || still) return;
    const t = setTimeout(() => setK((i) => (i + 1) % NEWS.length), EVERY);
    return () => clearTimeout(t);
  }, [k, paused, still, round]);

  const n = NEWS[k];
  const Icon = n.icon;
  const pause = () => setPaused(true);
  const resume = () => {
    setPaused(false);
    setRound((r) => r + 1);
  };

  return (
    <section aria-labelledby="news" className="border-t border-rule bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-[clamp(3rem,6vw,4.5rem)]">
        <Reveal className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-11 w-11" />
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-brand uppercase">Accel Newsroom</div>
              <h2 id="news" className="font-[Georgia,'Times_New_Roman',serif] text-[clamp(1.7rem,3.6vw,2.5rem)] leading-tight font-bold tracking-tight">What&apos;s new at Accel Business</h2>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-[0.14em] text-white uppercase">
            <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-white/80" /><span className="relative h-2 w-2 rounded-full bg-white" /></span>
            News flash
          </div>
        </Reveal>

        <div className="mt-8" onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume} role="region" aria-roledescription="carousel" aria-label="News flashes">
          {/* the horizontal card; keyed so each story flashes in */}
          <Link
            key={`${k}`}
            href={n.href}
            aria-live="polite"
            className="news-flash group relative grid overflow-hidden rounded-[1.4rem] border border-rule bg-white shadow-[var(--shadow-card)] md:min-h-[19rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
          >
            <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br md:aspect-auto ${n.tone}`}>
              <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.35)_1px,transparent_1px)] [background-size:14px_14px]" />
              <div aria-hidden className="absolute -right-10 -bottom-12 h-56 w-56 rounded-full bg-white/10" />
              <div aria-hidden className="absolute -top-16 -left-10 h-44 w-44 rounded-full bg-black/15" />
              <Icon aria-hidden className="news-icon absolute top-1/2 left-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_8px_22px_rgb(0_0_0/0.35)]" strokeWidth={1.5} />
              <span className="absolute top-4 left-4 rounded bg-white px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wider text-ink uppercase">{n.tag}</span>
              <LogoMark className="absolute right-4 bottom-4 h-9 w-9 drop-shadow" />
            </div>
            <div className="flex flex-col p-6 md:p-8">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[0.74rem] font-extrabold tracking-[0.14em] uppercase">
                  <LogoMark className="h-5 w-5" /> Accel <span className="font-semibold text-ink-soft">News</span>
                </span>
                <span className="rounded bg-brand px-1.5 py-0.5 text-[0.64rem] font-bold tracking-wider text-white uppercase">{k === 0 ? "Latest" : "Flash"}</span>
              </div>
              <div className="mt-5 text-[0.74rem] font-semibold tracking-wide text-ink-soft uppercase">{n.date} · {n.read}</div>
              <h3 className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-[clamp(1.35rem,2.4vw,1.9rem)] leading-snug font-bold">{n.title}</h3>
              <p className="mt-3 flex-1 text-[0.98rem] leading-relaxed text-ink-soft">{n.text}</p>
              <div className="mt-5 flex items-center justify-between border-t border-rule pt-4 text-sm">
                <span className="text-ink-soft">By Accel Business</span>
                <span className="inline-flex items-center gap-1 font-bold text-brand">Read story <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
              </div>
            </div>
            {/* time left on this story */}
            {!still && <span key={`${k}-${round}`} aria-hidden className="news-progress absolute bottom-0 left-0 h-1 bg-brand" style={{ animationDuration: `${EVERY}ms`, animationPlayState: paused ? "paused" : "running" }} />}
          </Link>

          {/* the other headlines, horizontally; tap one to jump to it */}
          <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Stories">
            {NEWS.map((s, i) => (
              <button
                key={s.title}
                role="tab"
                aria-selected={i === k}
                onClick={() => setK(i)}
                className={`flex min-w-[15rem] flex-1 items-start gap-3 rounded-xl border p-3 text-left transition-colors ${i === k ? "border-brand bg-white shadow-[var(--shadow-card)]" : "border-rule bg-white/60 hover:bg-white"}`}
              >
                <span className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${i === k ? "bg-brand" : "bg-rule"}`} />
                <span className="min-w-0">
                  <span className="block text-[0.68rem] font-bold tracking-wider text-brand uppercase">{s.tag} · {s.date}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[0.88rem] leading-snug font-semibold">{s.title}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
