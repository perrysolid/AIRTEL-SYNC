"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, BrickWall, Cable, Cctv, CloudUpload, Cpu, Factory, Globe, Mail, MessageCircle, MessageSquare, Package, Phone, PhoneCall,
  RadioTower, Receipt, RefreshCw, Router, ShieldCheck, Smartphone, Store, Truck, Utensils, Wifi, Briefcase, Building,
} from "lucide-react";
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

/** A real photo for each kind of business (public/photos, Unsplash licence) and a small icon for the tabs. */
const LOOK: Record<string, { photo: string; badge: typeof Store }> = {
  kirana: { photo: "/photos/kirana.jpg", badge: Store },
  cafe: { photo: "/photos/cafe.jpg", badge: Utensils },
  office: { photo: "/photos/office.jpg", badge: Briefcase },
  group: { photo: "/photos/group.jpg", badge: Building },
  factory: { photo: "/photos/factory.jpg", badge: Factory },
};

const EVERY = 6000;

/**
 * Ready-made plans for the most common kinds of business. One wide card at a time (a photo of a business like
 * theirs on the left, what's included and the price on the right) moves to the next plan, with a countdown and
 * tabs to jump between them. Prices come from the live pricing engine.
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
          <h2 id="plans" className="text-[clamp(1.7rem,3.6vw,2.6rem)] leading-tight font-extrabold tracking-tight">Plans for your kind of business</h2>
          <p className="max-w-md text-ink-soft">Start from one and change anything before you order. The price updates as you go.</p>
        </Reveal>

        {!p ? (
          <div className="mt-8 h-[22rem] animate-pulse rounded-[1.4rem] bg-white" />
        ) : (
          <div className="mt-8" onMouseEnter={() => setPaused(true)} onMouseLeave={resume} onFocus={() => setPaused(true)} onBlur={resume} role="region" aria-roledescription="carousel" aria-label="Ready-made plans">
            <article key={p.key} className="news-flash relative grid overflow-hidden rounded-[1.4rem] border border-rule bg-white shadow-[var(--shadow-card)] md:min-h-[22rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* who it's for: a real business like theirs */}
              <div className="relative min-h-[13rem] overflow-hidden bg-ink">
                <Image src={look.photo} alt="" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" priority={k === 0} />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute right-5 bottom-5 left-5 text-white">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/85"><Badge size={15} aria-hidden /> {p.for}</div>
                </div>
              </div>

              {/* the plan */}
              <div className="flex flex-col p-6 md:p-8">
                <h3 className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight font-extrabold tracking-tight">{p.name}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{p.tagline}</p>
                <ul className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2" aria-label="Included">
                  {p.items.map((it) => {
                    const Icon = iconFor(it.id);
                    return (
                      <li key={it.id} className="flex items-center gap-2.5 text-[0.95rem]">
                        <Icon size={17} strokeWidth={1.9} className="shrink-0 text-brand" aria-hidden />
                        <span className="min-w-0 truncate">{it.name}</span>
                        {it.qty > 1 && <span className="shrink-0 text-sm text-ink-soft tabular-nums">× {it.qty}</span>}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-5">
                  <div>
                    <div className="text-sm text-ink-soft">From</div>
                    <div className="text-[1.75rem] leading-tight font-extrabold tabular-nums">{inr(p.priceFrom)}<span className="text-base font-semibold text-ink-soft"> /month incl. GST</span></div>
                    <div className="mt-0.5 text-sm text-ink-soft">{p.setupTo ? `Setup up to ${inr(p.setupTo)}, free on 36 months` : "No setup fee"}</div>
                  </div>
                  <Link href={`/advisor?lang=${lang}&q=${encodeURIComponent(p.start)}`} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-extrabold text-white transition-transform hover:-translate-y-0.5">
                    Get this plan <ArrowRight size={16} />
                  </Link>
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
