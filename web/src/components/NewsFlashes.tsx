import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

/** Platform news. Every item describes something this prototype really does; figures come from the case data. */
const NEWS: { date: string; tag: string; title: string; text: string; href: string; cta: string }[] = [
  {
    date: "Nov 2026",
    tag: "Safety",
    title: "Scam Shield now reads screenshots and forwarded links",
    text: "Forward a fake KYC message or a 'payment received' screenshot and get a verdict, the red flags and what to do next, with Chakshu and 1930 one tap away. English and Hindi.",
    href: "/shield",
    cta: "Check a message",
  },
  {
    date: "Nov 2026",
    tag: "Network",
    title: "No fibre on your street? Your plan switches to 5G AirFiber",
    text: "The Network Reality Check looks at your pincode before you pay, and the quote re-prices itself onto AirFiber when fibre can't reach you. No surprise cancellations.",
    href: "/network",
    cta: "Check your pincode",
  },
  {
    date: "Oct 2026",
    tag: "Growth",
    title: "Opening a second shop takes one tap with Branch-in-a-Box",
    text: "Copy your head-office setup to the new address, reuse your KYC and agreement, and only upload the new address proof. The install is booked in the same flow.",
    href: "/solutions",
    cta: "See how it works",
  },
  {
    date: "Oct 2026",
    tag: "Reach",
    title: "2,017 businesses we lost now get a personal link back in",
    text: "1,632 owners were never reached and 385 dropped at a slow quote. Each now gets a link that opens the chat with their details filled in, in their own language.",
    href: "/how-it-works",
    cta: "Why leads drop off",
  },
];

/** "What's new": four news flashes, the newest one marked live. */
export function NewsFlashes() {
  return (
    <section aria-labelledby="news" className="border-t border-rule bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-[clamp(3rem,6vw,4.5rem)]">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-[0.14em] text-white uppercase">
              <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-white/80" /><span className="relative h-2 w-2 rounded-full bg-white" /></span>
              News flash
            </div>
            <h2 id="news" className="mt-3 text-[clamp(1.7rem,3.6vw,2.6rem)] leading-tight font-extrabold tracking-tight">What&apos;s new at Accel Business</h2>
          </div>
          <p className="max-w-md text-ink-soft">New tools and changes for the shops and offices on our network, as they ship.</p>
        </Reveal>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NEWS.map((n, i) => (
            <li key={n.title}>
              <Reveal delay={i * 100} className="h-full">
                <Link href={n.href} className="group flex h-full flex-col rounded-[1.4rem] border border-rule bg-white p-5 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 font-bold text-brand">{n.tag}</span>
                    <span className="text-ink-soft">{n.date}</span>
                  </div>
                  <h3 className="mt-4 text-[1.08rem] leading-snug font-extrabold">{n.title}</h3>
                  <p className="mt-2 flex-1 text-[0.93rem] leading-relaxed text-ink-soft">{n.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                    {n.cta} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
