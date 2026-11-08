import Link from "next/link";
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
    text: "Forward a fake KYC message or a 'payment received' screenshot and get a verdict, the red flags and what to do next. Chakshu and 1930 are one tap away.",
    href: "/shield",
  },
  {
    date: "2 Nov 2026",
    read: "2 min read",
    tag: "Network",
    icon: Radar,
    tone: "from-[#06122b] via-[#0b2f6b] to-[#1f6fd1]",
    title: "No fibre on your street? Plans now switch to 5G AirFiber",
    text: "The Network Reality Check reads your pincode before you pay, and the quote re-prices itself onto AirFiber when fibre can't reach you.",
    href: "/network",
  },
  {
    date: "28 Oct 2026",
    read: "3 min read",
    tag: "Growth",
    icon: Store,
    tone: "from-[#1d1203] via-[#7a4a00] to-[#f2a900]",
    title: "Opening a second shop now takes one tap",
    text: "Branch-in-a-Box copies your head-office setup to a new address and reuses your KYC and agreement. Only the new address proof is needed.",
    href: "/solutions",
  },
  {
    date: "21 Oct 2026",
    read: "3 min read",
    tag: "Reach",
    icon: Link2,
    tone: "from-[#04170f] via-[#0b5a3a] to-[#12a05e]",
    title: "2,017 businesses we lost get a personal link back in",
    text: "1,632 owners were never reached and 385 dropped at a slow quote. Each now gets a link that opens the chat with their details filled in.",
    href: "/how-it-works",
  },
];

/** "Accel Newsroom": four news cards, each with the Accel masthead, a picture panel, a dateline and a byline. */
export function NewsFlashes() {
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

        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {NEWS.map((n, i) => {
            const Icon = n.icon;
            return (
              <li key={n.title}>
                <Reveal delay={i * 100} className="h-full">
                  <Link href={n.href} className="group flex h-full flex-col overflow-hidden rounded-[1.1rem] border border-rule bg-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1">
                    {/* masthead */}
                    <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                      <span className="inline-flex items-center gap-2 text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">
                        <LogoMark className="h-5 w-5" /> Accel <span className="font-semibold text-ink-soft">News</span>
                      </span>
                      {i === 0 && <span className="rounded bg-brand px-1.5 py-0.5 text-[0.62rem] font-bold tracking-wider text-white uppercase">Latest</span>}
                    </div>
                    {/* picture panel */}
                    <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${n.tone}`}>
                      <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.35)_1px,transparent_1px)] [background-size:14px_14px]" />
                      <div aria-hidden className="absolute -right-6 -bottom-8 h-36 w-36 rounded-full bg-white/10" />
                      <Icon aria-hidden className="absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_6px_18px_rgb(0_0_0/0.35)] transition-transform duration-500 group-hover:scale-110" strokeWidth={1.6} />
                      <span className="absolute top-3 left-3 rounded bg-white px-2 py-0.5 text-[0.68rem] font-extrabold tracking-wider text-ink uppercase">{n.tag}</span>
                      <LogoMark className="absolute right-3 bottom-3 h-7 w-7 drop-shadow" />
                    </div>
                    {/* story */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="text-[0.72rem] font-semibold tracking-wide text-ink-soft uppercase">{n.date} · {n.read}</div>
                      <h3 className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-[1.12rem] leading-snug font-bold">{n.title}</h3>
                      <p className="mt-2 flex-1 text-[0.9rem] leading-relaxed text-ink-soft">{n.text}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-xs">
                        <span className="text-ink-soft">By Accel Business</span>
                        <span className="inline-flex items-center gap-1 font-bold text-brand">Read story <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
