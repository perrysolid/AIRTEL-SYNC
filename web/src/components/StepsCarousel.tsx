"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STEPS: { name: string; text: string; art: Art }[] = [
  { name: "Talk", text: "Tell Udyam about your shop by voice or chat, in your own language.", art: "talk" },
  { name: "See your plan", text: "One monthly price for everything. Switch add-ons on or off yourself.", art: "plan" },
  { name: "Verify in 2 minutes", text: "DigiLocker or a few photos. No visits, no couriers.", art: "verify" },
  { name: "E-sign", text: "Sign the agreement with a one-time code on your phone.", art: "sign" },
  { name: "Pay", text: "UPI AutoPay sets up your one monthly bill in a single tap.", art: "pay" },
  { name: "Go live", text: "SIMs today, internet in days, and every update on WhatsApp.", art: "live" },
];

type Art = "talk" | "plan" | "verify" | "sign" | "pay" | "live";

const RED = "var(--brand)";
const INK = "#1f1f1f";
const SOFT = "#f1f1f4";
const LINE = "#d9d9e0";

/** One animated illustration per step. Shapes only, drawn at 240×180; animation classes live in globals.css (st-*). */
function StepArt({ art }: { art: Art }) {
  const common = { viewBox: "0 0 240 180", className: "h-full w-full overflow-visible", "aria-hidden": true } as const;
  switch (art) {
    case "talk":
      return (
        <svg {...common}>
          {[0, 1, 2].map((i) => <circle key={i} cx="120" cy="88" r="40" fill="none" stroke={RED} strokeWidth="2" className="st-pulse" style={{ animationDelay: `${i * 0.8}s` }} />)}
          <circle cx="120" cy="88" r="36" fill={RED} />
          <rect x="111" y="66" width="18" height="30" rx="9" fill="#fff" />
          <path d="M104 88a16 16 0 0 0 32 0M120 104v8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <g className="st-pop" style={{ animationDelay: "0.2s" }}>
            <rect x="8" y="26" width="72" height="30" rx="12" fill={SOFT} />
            <path d="M70 52l12 10-2-12z" fill={SOFT} />
            <rect x="18" y="36" width="44" height="4" rx="2" fill={LINE} /><rect x="18" y="44" width="30" height="4" rx="2" fill={LINE} />
          </g>
          <g className="st-pop" style={{ animationDelay: "1s" }}>
            <rect x="160" y="40" width="74" height="30" rx="12" fill={INK} />
            <path d="M168 66l-12 10 2-12z" fill={INK} />
            <rect x="170" y="50" width="46" height="4" rx="2" fill="#fff" opacity=".7" /><rect x="170" y="58" width="28" height="4" rx="2" fill="#fff" opacity=".5" />
          </g>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={93 + i * 8} y="140" width="5" height="26" rx="2.5" fill={i % 2 ? INK : RED} className="st-eq" style={{ animationDelay: `${(i % 4) * 0.15}s` }} />)}
        </svg>
      );
    case "plan":
      return (
        <svg {...common}>
          <rect x="62" y="10" width="116" height="160" rx="12" fill="#fff" stroke={LINE} strokeWidth="2" />
          <rect x="62" y="10" width="116" height="28" rx="12" fill={RED} /><rect x="62" y="26" width="116" height="12" fill={RED} />
          <rect x="74" y="20" width="48" height="6" rx="3" fill="#fff" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x="74" y={52 + i * 22} width={[62, 50, 70, 44][i]} height="7" rx="3.5" fill={i === 2 ? RED : LINE} className="st-grow" style={{ animationDelay: `${i * 0.35}s` }} />
              <rect x="150" y={52 + i * 22} width="16" height="7" rx="3.5" fill={LINE} />
            </g>
          ))}
          <path d="M74 142h92" stroke={LINE} strokeWidth="2" strokeDasharray="4 4" />
          <rect x="74" y="150" width="34" height="9" rx="4.5" fill={INK} /><rect x="132" y="148" width="34" height="13" rx="6.5" fill={RED} />
          <g transform="translate(190 70)">
            <rect width="36" height="20" rx="10" fill={SOFT} stroke={LINE} />
            <circle cx="10" cy="10" r="7" fill={RED} className="st-toggle" />
          </g>
        </svg>
      );
    case "verify":
      return (
        <svg {...common}>
          <rect x="34" y="34" width="172" height="112" rx="14" fill="#fff" stroke={LINE} strokeWidth="2" />
          <rect x="34" y="34" width="172" height="22" rx="14" fill={SOFT} /><rect x="34" y="46" width="172" height="10" fill={SOFT} />
          <circle cx="78" cy="98" r="22" fill={SOFT} /><circle cx="78" cy="92" r="8" fill={LINE} /><path d="M62 114a16 12 0 0 1 32 0" fill={LINE} />
          {[0, 1, 2].map((i) => <rect key={i} x="112" y={80 + i * 14} width={[70, 52, 60][i]} height="7" rx="3.5" fill={LINE} />)}
          <g className="st-scan">
            <rect x="40" y="58" width="160" height="3" rx="1.5" fill={RED} />
            <rect x="40" y="46" width="160" height="14" fill={RED} opacity=".12" />
          </g>
          <g className="st-pop" style={{ animationDelay: "1.4s" }}>
            <circle cx="196" cy="40" r="17" fill="var(--signal)" />
            <path d="M188 40l6 6 10-11" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      );
    case "sign":
      return (
        <svg {...common}>
          <rect x="40" y="14" width="160" height="112" rx="12" fill="#fff" stroke={LINE} strokeWidth="2" />
          {[0, 1, 2].map((i) => <rect key={i} x="56" y={30 + i * 12} width={[110, 96, 80][i]} height="6" rx="3" fill={SOFT} />)}
          <path d="M56 104h128" stroke={LINE} strokeWidth="2" />
          <path d="M60 100c10-24 18-26 20-10s6 16 14-4 14-16 14 0 10 8 22-6 14 4 20 2" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={100} className="st-draw" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i} transform={`translate(${54 + i * 23} 140)`}>
              <rect width="18" height="24" rx="5" fill={SOFT} stroke={LINE} />
              <circle cx="9" cy="12" r="3.5" fill={RED} className="st-blink" style={{ animationDelay: `${i * 0.25}s` }} />
            </g>
          ))}
        </svg>
      );
    case "pay":
      return (
        <svg {...common}>
          <rect x="84" y="40" width="72" height="132" rx="14" fill={INK} />
          <rect x="90" y="48" width="60" height="116" rx="9" fill="#fff" />
          <circle cx="120" cy="104" r="24" fill="none" stroke="var(--signal)" strokeWidth="4" pathLength={100} className="st-draw" style={{ animationDelay: "0.9s" }} />
          <path d="M110 104l7 7 13-14" fill="none" stroke="var(--signal)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={100} className="st-draw" style={{ animationDelay: "1.3s" }} />
          <rect x="100" y="140" width="40" height="8" rx="4" fill={SOFT} />
          <g className="st-drop">
            <circle cx="120" cy="22" r="17" fill={RED} />
            <text x="120" y="29" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" fontFamily="inherit">₹</text>
          </g>
          <g className="st-pop" style={{ animationDelay: "1.6s" }}>
            <rect x="160" y="70" width="70" height="24" rx="12" fill={SOFT} />
            <text x="195" y="86" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily="inherit">AutoPay on</text>
          </g>
        </svg>
      );
    case "live":
      return (
        <svg {...common}>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${120 - 26 - i * 18} ${78 - i * 12}a${36 + i * 25} ${36 + i * 25} 0 0 1 ${52 + i * 36} 0`} fill="none" stroke={RED} strokeWidth="5" strokeLinecap="round" className="st-wave" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
          <rect x="70" y="92" width="100" height="34" rx="10" fill={INK} />
          <path d="M92 92V68M148 92V68" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          {[0, 1, 2].map((i) => <circle key={i} cx={92 + i * 14} cy="109" r="4" fill="var(--signal)" className="st-blink" style={{ animationDelay: `${i * 0.3}s` }} />)}
          <rect x="140" y="104" width="20" height="10" rx="5" fill="#3a3a44" />
          {["SIMs", "Fibre", "Billing"].map((t, i) => (
            <g key={t} transform={`translate(${30 + i * 64} 140)`}>
              <rect width="56" height="26" rx="13" className="st-light" style={{ animationDelay: `${0.4 + i * 0.6}s` }} fill={SOFT} />
              <text x="28" y="17" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily="inherit">{t}</text>
            </g>
          ))}
        </svg>
      );
  }
}

/**
 * "From hello to live": the six steps on a slowly turning 3D ring. The front card faces you; its neighbours bend
 * back on the curve. It pauses while you hover or focus it, has arrows and dots, and holds still for reduced motion.
 */
export function StepsCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const n = STEPS.length;
  const active = ((idx % n) + n) % n;
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => {
    if (paused || still) return;
    timer.current = setInterval(() => setIdx((i) => i + 1), 4200);
    return () => clearInterval(timer.current);
  }, [paused, still]);

  const go = (d: number) => setIdx((i) => i + d);
  const goTo = (k: number) => setIdx((i) => i + (((k - active + n + n / 2) % n) - n / 2));

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="steps-viewport relative mx-auto h-[26rem] sm:h-[25rem]" style={{ ["--cw" as string]: "min(42rem, 86vw)" }}>
        <ol
          className="steps-ring absolute inset-0"
          style={{ transform: `translateZ(calc(var(--R) * -1)) rotateY(${-idx * (360 / n)}deg)`, transitionDuration: still ? "0ms" : undefined }}
          aria-live="polite"
        >
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <li
                key={s.name}
                aria-hidden={!on}
                className={`steps-card @container absolute top-0 left-1/2 h-full overflow-hidden rounded-[2rem] border border-rule bg-white shadow-[0_30px_60px_-30px_rgb(31_31_31/0.45)] ${on ? "" : "st-paused"}`}
                style={{ transform: `translateX(-50%) rotateY(${i * (360 / n)}deg) translateZ(var(--R))`, opacity: on ? 1 : 0.55 }}
              >
                <div className="grid h-full grid-rows-[auto_1fr_auto_auto] items-center gap-2 p-6 text-center @lg:grid-cols-[4rem_minmax(0,1fr)_10rem] @lg:grid-rows-1 @lg:gap-5 @lg:p-7 @lg:text-left">
                  <div className="text-left text-[2.2rem] leading-none font-extrabold text-brand tabular-nums @lg:text-[4.2rem] @lg:text-brand/90">
                    {String(i + 1).padStart(2, "0")}
                    <div className="mt-1 text-[0.7rem] font-bold tracking-[0.16em] text-ink-soft uppercase @lg:mt-2">Step</div>
                  </div>
                  <div className="flex min-h-0 flex-col items-center">
                    <div className="aspect-[4/3] w-full max-w-[15rem] @lg:max-w-[19rem]"><StepArt art={s.art} /></div>
                    <h3 className="mt-2 text-xl font-extrabold tracking-tight @lg:text-[1.45rem]">{s.name}</h3>
                  </div>
                  <p className="text-[0.98rem] leading-snug text-ink-soft @lg:border-l @lg:border-rule @lg:pl-5 @lg:text-[1.02rem]">{s.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button onClick={() => go(-1)} aria-label="Previous step" className="grid h-10 w-10 place-items-center rounded-full border border-rule bg-white hover:bg-paper"><ChevronLeft size={18} /></button>
        <div className="flex gap-2" role="tablist" aria-label="Steps">
          {STEPS.map((s, i) => (
            <button key={s.name} role="tab" aria-selected={i === active} aria-label={`Step ${i + 1}: ${s.name}`} onClick={() => goTo(i)} className={`h-2.5 rounded-full transition-all ${i === active ? "w-7 bg-brand" : "w-2.5 bg-rule hover:bg-ink-soft"}`} />
          ))}
        </div>
        <button onClick={() => go(1)} aria-label="Next step" className="grid h-10 w-10 place-items-center rounded-full border border-rule bg-white hover:bg-paper"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}
