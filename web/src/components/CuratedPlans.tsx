"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, BrickWall, Cable, Cctv, CloudUpload, Cpu, Factory, Globe, Mail, MessageCircle, MessageSquare, Package, Phone, PhoneCall,
  RadioTower, Receipt, RefreshCw, Router, ShieldCheck, Smartphone, Store, Truck, Utensils, Wifi, Briefcase, Building,
} from "lucide-react";
import { LogoMark } from "./Brand";
import { Reveal } from "./Reveal";
import { inr } from "@/lib/format";

type Plan = {
  key: string;
  name: string;
  for: string;
  tagline: string;
  start: string;
  items: { id: string; name: string; category: string; qty: number }[];
  priceFrom: number;
  priceTo: number;
  setupFrom: number;
  setupTo: number;
  liveInDays: number;
};

/** A picture for each product in the catalogue (P01-P25), so a plan shows what's in it at a glance. */
const ICON: Record<string, typeof Wifi> = {
  P01: Router, P02: Router, P03: Router, P04: RadioTower, P05: Cable, P06: Cable, P07: Smartphone, P08: Smartphone, P09: RefreshCw,
  P10: Phone, P11: Phone, P12: PhoneCall, P13: PhoneCall, P14: MessageSquare, P15: MessageCircle, P16: Mail, P17: CloudUpload, P18: Globe,
  P19: Receipt, P20: ShieldCheck, P21: BrickWall, P22: Wifi, P23: Cctv, P24: Cpu, P25: Truck,
};
const iconFor = (id: string) => ICON[id] ?? Package;

const LOOK: Record<string, { tone: string; badge: typeof Store }> = {
  kirana: { tone: "from-[#2b0a12] via-[#7a0016] to-[#e40000]", badge: Store },
  cafe: { tone: "from-[#1d1203] via-[#7a4a00] to-[#f2a900]", badge: Utensils },
  office: { tone: "from-[#06122b] via-[#0b2f6b] to-[#1f6fd1]", badge: Briefcase },
  group: { tone: "from-[#04170f] via-[#0b5a3a] to-[#12a05e]", badge: Building },
  factory: { tone: "from-[#14141a] via-[#3a3a48] to-[#6d6d80]", badge: Factory },
};

const EVERY = 6000;

/**
 * "Plans you may find useful": ready-made plans for the most common kinds of business. One wide card at a time
 * (a picture of everything in the plan on the left, the details on the right) flashes to the next plan, with a
 * countdown and tabs to jump between them. Prices come from the live pricing engine.
 */
export function CuratedPlans({ lang }: { lang: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [k, setK] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    fetch("/api/plans")
      .then((r) => r.json())
      .then((j) => setPlans(j.plans ?? []))
      .catch(() => setPlans([]));
  }, []);
  useEffect(() => {
    if (paused || still || plans.length < 2) return;
    const t = setTimeout(() => setK((i) => (i + 1) % plans.length), EVERY);
    return () => clearTimeout(t);
  }, [k, paused, still, round, plans.length]);

  const p = plans[k];
  const look = p ? (LOOK[p.key] ?? LOOK.kirana) : LOOK.kirana;
  const Badge = look.badge;
  const resume = () => {
    setPaused(false);
    setRound((r) => r + 1);
  };

  return (
    <section aria-labelledby="plans" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-[clamp(3rem,6vw,4.5rem)]">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.16em] text-brand uppercase">Ready-made plans</div>
            <h2 id="plans" className="mt-2 text-[clamp(1.7rem,3.6vw,2.6rem)] leading-tight font-extrabold tracking-tight">Plans you may find useful</h2>
          </div>
          <p className="max-w-md text-ink-soft">Built around what businesses like yours need most. Start from one and change anything; the price updates as you go.</p>
        </Reveal>

        {!p ? (
          <div className="mt-8 h-[22rem] animate-pulse rounded-[1.4rem] bg-white" />
        ) : (
          <div className="mt-8" onMouseEnter={() => setPaused(true)} onMouseLeave={resume} onFocus={() => setPaused(true)} onBlur={resume} role="region" aria-roledescription="carousel" aria-label="Ready-made plans">
            <article key={p.key} className="news-flash relative grid overflow-hidden rounded-[1.4rem] border border-rule bg-white shadow-[var(--shadow-card)] md:min-h-[21rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              {/* a picture of what's in the plan */}
              <div className={`relative overflow-hidden bg-gradient-to-br p-6 ${look.tone}`}>
                <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.35)_1px,transparent_1px)] [background-size:14px_14px]" />
                <div aria-hidden className="absolute -right-10 -bottom-12 h-56 w-56 rounded-full bg-white/10" />
                <div className="relative flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded bg-white px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wider text-ink uppercase"><Badge size={13} /> {p.for}</span>
                  <LogoMark className="h-8 w-8 drop-shadow" />
                </div>
                <ul className="relative mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-3" aria-label="Included">
                  {p.items.map((it, i) => {
                    const Icon = iconFor(it.id);
                    return (
                      <li key={it.id} className="news-icon flex flex-col items-center gap-1.5 rounded-2xl bg-white/12 p-3 text-center text-white backdrop-blur-sm" style={{ animationDelay: `${150 + i * 90}ms` }}>
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-ink shadow"><Icon size={22} strokeWidth={1.9} /></span>
                        <span className="text-[0.72rem] leading-tight font-semibold">{it.name}{it.qty > 1 ? ` × ${it.qty}` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* the plan */}
              <div className="flex flex-col p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[0.74rem] font-extrabold tracking-[0.14em] uppercase"><LogoMark className="h-5 w-5" /> Accel <span className="font-semibold text-ink-soft">Plan</span></span>
                  <span className="rounded bg-brand px-1.5 py-0.5 text-[0.64rem] font-bold tracking-wider text-white uppercase">Live in ~{p.liveInDays} days</span>
                </div>
                <h3 className="mt-4 text-[clamp(1.5rem,2.6vw,2rem)] leading-tight font-extrabold tracking-tight">{p.name}</h3>
                <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-soft">{p.tagline}</p>
                <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Monthly, incl. GST</div>
                    <div className="text-[1.7rem] leading-tight font-extrabold tabular-nums">{inr(p.priceFrom)} – {inr(p.priceTo)}</div>
                  </div>
                  <div className="text-sm text-ink-soft">
                    One-time setup {p.setupFrom === p.setupTo ? inr(p.setupTo) : `${p.setupFrom ? inr(p.setupFrom) : "₹0"} – ${inr(p.setupTo)}`}
                    <div>Lowest price on a 36-month term</div>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-rule pt-5">
                  <Link href={`/advisor?lang=${lang}&q=${encodeURIComponent(p.start)}`} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-extrabold text-white shadow-[0_12px_26px_-14px_var(--brand)] transition-transform hover:-translate-y-0.5">
                    Get this plan <ArrowRight size={16} />
                  </Link>
                  <span className="text-sm text-ink-soft">Adjust items, quantities and term before you order.</span>
                </div>
              </div>
              {!still && <span key={`${k}-${round}`} aria-hidden className="news-progress absolute bottom-0 left-0 h-1 bg-brand" style={{ animationDuration: `${EVERY}ms`, animationPlayState: paused ? "paused" : "running" }} />}
            </article>

            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Plans">
              {plans.map((x, i) => {
                const B = (LOOK[x.key] ?? LOOK.kirana).badge;
                return (
                  <button
                    key={x.key}
                    role="tab"
                    aria-selected={i === k}
                    onClick={() => setK(i)}
                    className={`flex min-w-[12.5rem] flex-1 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${i === k ? "border-brand bg-white shadow-[var(--shadow-card)]" : "border-rule bg-white/60 hover:bg-white"}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${i === k ? "bg-brand text-white" : "bg-paper text-ink-soft"}`}><B size={18} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.9rem] font-bold">{x.name}</span>
                      <span className="block truncate text-[0.75rem] text-ink-soft">from {inr(x.priceFrom)}/mo</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
