"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BarChart3, Flame, PhoneCall, Star, Users } from "lucide-react";
import { CountUp } from "@/components/motion/CountUp";

const view = { once: true, margin: "-15% 0px" } as const;

// ---------------------------------------------------------------------------
// The money: one bill replacing five vendors
// ---------------------------------------------------------------------------

const BILL = [
  { name: "Biz Fibre 100", note: "1 site", price: 999 },
  { name: "Business SIMs", note: "2 lines × ₹299", price: 598 },
  { name: "POS & UPI billing", note: "1 counter", price: 599 },
  { name: "Cloud CCTV", note: "2 cameras × ₹199", price: 398 },
];
const SUBTOTAL = BILL.reduce((s, l) => s + l.price, 0);
const DISCOUNT = Math.round(SUBTOTAL * 0.05);
const GST = Math.round((SUBTOTAL - DISCOUNT) * 0.18);
const TOTAL = SUBTOTAL - DISCOUNT + GST;
const TODAY = [
  { name: "Broadband from the local cable operator", price: 1180 },
  { name: "Two prepaid SIMs, recharged by hand", price: 798 },
  { name: "Billing software licence", price: 750 },
  { name: "CCTV DVR maintenance", price: 600 },
];
const TODAY_TOTAL = TODAY.reduce((s, l) => s + l.price, 0);

export function Money() {
  const reduce = useReducedMotion();
  const line = (k: number) => (reduce ? {} : { initial: { opacity: 0, y: -8, clipPath: "inset(0 0 100% 0)" }, whileInView: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }, viewport: view, transition: { delay: 0.25 + k * 0.22, duration: 0.4 } });
  return (
    <section aria-labelledby="money" className="night relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <h2 id="money" className="text-4xl font-extrabold sm:text-5xl">Four vendors become one bill</h2>
          <p className="mt-4 max-w-md text-lg text-white/70">Every rupee is on the bill before you agree to anything. Bundle it and the One Bill discount comes off automatically.</p>
          <ul className="mt-8 max-w-md space-y-3">
            {TODAY.map((t, k) => (
              <motion.li key={t.name} className="flex items-baseline justify-between gap-4 text-white/60" initial={reduce ? false : { opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={view} transition={{ delay: 0.1 + k * 0.12 }}>
                <span className="relative">
                  {t.name}
                  {!reduce && <motion.span aria-hidden className="absolute top-1/2 left-0 h-0.5 bg-brand" initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={view} transition={{ delay: 1.3 + k * 0.15, duration: 0.35 }} />}
                </span>
                <span className="shrink-0 tabular-nums">₹{t.price.toLocaleString("en-IN")}</span>
              </motion.li>
            ))}
          </ul>
          <div className="mt-6 max-w-md border-t border-white/15 pt-4 text-white/60">
            Today: four bills, four helplines, <span className="tabular-nums">₹{TODAY_TOTAL.toLocaleString("en-IN")}</span> a month
          </div>
        </div>

        <motion.div className="relative mx-auto w-full max-w-sm" initial={reduce ? false : { opacity: 0, y: 40, rotate: 2 }} whileInView={{ opacity: 1, y: 0, rotate: -1.5 }} viewport={view} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
          <div aria-hidden className="absolute -inset-6 rounded-[40px] bg-brand/30 blur-3xl" />
          <div className="receipt relative rounded-t-2xl px-6 pt-6 text-[14px] text-ink shadow-[var(--shadow-lift)]">
            <div className="text-center">
              <div className="font-semibold">ACCEL BUSINESS</div>
              <div className="text-ink-soft">for Sharma Kirana, Jaipur</div>
              <div className="text-ink-soft">12-month plan, prices per month</div>
            </div>
            <div className="my-4 border-t border-dashed border-rule" />
            <ul className="space-y-3">
              {BILL.map((l, k) => (
                <motion.li key={l.name} {...line(k)}>
                  <div className="flex items-baseline"><span className="font-semibold">{l.name}</span><span className="dotted-fill" /><span className="tabular-nums">₹{l.price}</span></div>
                  <div className="text-ink-soft">{l.note}</div>
                </motion.li>
              ))}
            </ul>
            <div className="my-4 border-t border-dashed border-rule" />
            <motion.div {...line(4)} className="space-y-1">
              <div className="flex"><span>Subtotal</span><span className="dotted-fill" /><span className="tabular-nums">₹{SUBTOTAL.toLocaleString("en-IN")}</span></div>
              <div className="flex text-ok"><span>One Bill discount 5%</span><span className="dotted-fill" /><span className="tabular-nums">− ₹{DISCOUNT}</span></div>
              <div className="flex"><span>GST 18%</span><span className="dotted-fill" /><span className="tabular-nums">₹{GST}</span></div>
            </motion.div>
            <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-3">
              <span className="font-semibold">TOTAL / MONTH</span>
              <CountUp value={TOTAL} duration={1.6} className="text-3xl font-semibold text-brand" />
            </div>
            <motion.div {...line(6)} className="mt-4 rounded-lg bg-ok/10 px-3 py-2 text-center font-sans font-semibold text-ok">
              ₹{(TODAY_TOTAL - TOTAL).toLocaleString("en-IN")} less than today, with GST included
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Back office: who to call, scored by the propensity model
// ---------------------------------------------------------------------------

const LEADS = [
  { name: "Balaji Dental Care", city: "Kochi", p: 0.31, why: "Referral, 20 staff, GST registered" },
  { name: "Shree Ganesh Textiles", city: "Surat", p: 0.24, why: "Channel partner, 3 sites" },
  { name: "Nova Diagnostics", city: "Pune", p: 0.17, why: "Inbound call, wants CCTV" },
  { name: "Patel Hardware", city: "Rajkot", p: 0.09, why: "Field sales, 1 site" },
  { name: "Green Leaf Cafe", city: "Indore", p: 0.04, why: "WhatsApp campaign, no GST" },
];

export function ForTeams() {
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="teams" className="bg-paper">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-28">
        <motion.div className="card overflow-hidden" initial={reduce ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={view} transition={{ duration: 0.6 }}>
          <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
            <div className="flex items-center gap-2 font-semibold"><PhoneCall size={17} className="text-brand" /> Who to call today</div>
            <span className="text-sm text-ink-soft">Sorted by chance to activate</span>
          </div>
          <ul>
            {LEADS.map((l, k) => {
              const band = l.p >= 0.15 ? "hot" : l.p >= 0.07 ? "warm" : "cold";
              return (
                <li key={l.name} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-4 border-b border-rule px-5 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{l.name}</span>
                      {band === "hot" && <Flame size={15} className="shrink-0 text-brand" />}
                    </div>
                    <div className="truncate text-sm text-ink-soft">{l.city}, {l.why}</div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm"><span className={band === "hot" ? "font-semibold text-brand" : band === "warm" ? "text-marigold-deep" : "text-ink-soft"}>{band}</span><span className="tabular-nums font-semibold">{Math.round(l.p * 100)}%</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-rule">
                      <motion.div className={`h-full rounded-full ${band === "hot" ? "bg-brand" : band === "warm" ? "bg-marigold" : "bg-ink-soft/40"}`} initial={{ width: reduce ? `${(l.p / 0.35) * 100}%` : 0 }} whileInView={{ width: `${(l.p / 0.35) * 100}%` }} viewport={view} transition={{ delay: 0.3 + k * 0.12, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.div>

        <div>
          <h2 id="teams" className="text-4xl font-extrabold sm:text-5xl">Your sales team calls the right shops first</h2>
          <p className="mt-4 text-lg text-ink-soft">The sales portal scores every lead with a model trained on 5,000 past leads, explains each score, and hands over chats the advisor couldn&apos;t close.</p>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {[
              { v: 2.39, f: (n: number) => `${n.toFixed(1)}×`, l: "more activations in the top tenth of leads" },
              { v: 0.745, f: (n: number) => n.toFixed(2), l: "model AUC on held-out leads" },
              { v: 2017, f: (n: number) => Math.round(n).toLocaleString("en-IN"), l: "lost leads with a win-back link ready" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="text-3xl font-extrabold"><CountUp value={s.v} format={s.f} duration={1.4} /></dd>
                <dd className="mt-1 text-sm leading-snug text-ink-soft">{s.l}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sales" className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-3"><BarChart3 size={18} /> Open the sales portal</Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft"><Users size={15} /> For Accel sales staff and channel partners</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const STORIES = [
  { name: "Sunita Sharma", biz: "Kirana store, Jaipur", lang: "Hindi", quote: "मैंने बस बोलकर बताया, और शाम तक दोनों SIM चालू थे। किसी को फ़ोन नहीं करना पड़ा।", stat: "SIMs live same day" },
  { name: "Dr. Anil Menon", biz: "Dental clinic, Kochi", lang: "Malayalam", quote: "The quote explained why each item was there. I switched off the toll-free number myself and ordered.", stat: "Ordered in 11 minutes" },
  { name: "Farhan Qureshi", biz: "Boutique, Lucknow", lang: "Hindi", quote: "GST certificate ki photo li, do minute mein verify. Pehle iske liye teen din lagte the.", stat: "Verified in 2 minutes" },
  { name: "Lakshmi Iyer", biz: "Coaching centre, Chennai", lang: "Tamil", quote: "Every step came on WhatsApp with a picture of where my order was. I never had to chase anyone.", stat: "0 follow-up calls" },
  { name: "Harpreet Singh", biz: "Auto parts, Ludhiana", lang: "Punjabi", quote: "Four bills became one, and it's cheaper than what I paid the cable guy and the CCTV man together.", stat: "₹1,100 a month saved" },
  { name: "Megha Patil", biz: "Bakery, Nashik", lang: "Marathi", quote: "I told it my budget was ₹2,500 and it trimmed the plan to fit instead of upselling me.", stat: "Plan fitted to budget" },
];

export function Stories() {
  const row = [...STORIES, ...STORIES];
  return (
    <section aria-labelledby="stories" className="overflow-hidden bg-sheet py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="stories" className="text-4xl font-extrabold sm:text-5xl">Built for owners who are too busy for a sales visit</h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">What owners told us when we walked them through the journey. Names and details changed for the prototype.</p>
      </div>
      <div className="mt-12 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <ul className="marquee flex w-max gap-5 px-4">
          {row.map((s, k) => (
            <li key={k} aria-hidden={k >= STORIES.length} className="card flex w-[320px] shrink-0 flex-col p-6 sm:w-[360px]">
              <div className="flex gap-0.5 text-marigold" aria-label="5 out of 5">
                {Array.from({ length: 5 }, (_, i) => <Star key={i} size={16} fill="currentColor" strokeWidth={0} />)}
              </div>
              <blockquote className="mt-3 flex-1 text-[17px] leading-relaxed">“{s.quote}”</blockquote>
              <div className="mt-5 inline-flex w-fit rounded-full bg-brand/8 px-3 py-1 text-sm font-semibold text-brand">{s.stat}</div>
              <div className="mt-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-night font-bold text-white">{s.name.split(" ").map((w) => w[0]).slice(-2).join("")}</span>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-ink-soft">{s.biz}, spoke in {s.lang}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
