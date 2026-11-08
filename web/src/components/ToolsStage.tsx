import Link from "next/link";
import { CalendarClock, HeartPulse, MessageCircle, Radar, ShieldCheck, Store } from "lucide-react";
import { PhoneMock } from "./PhoneMock";
import { Reveal } from "./Reveal";

type Tool = { icon: typeof ShieldCheck; title: string; text: string; href: string; rot: number; shift: number };

// Left column then right column; `rot` is the tilt, `shift` pushes a card toward or away from the phone.
const LEFT: Tool[] = [
  { icon: ShieldCheck, title: "Scam Shield", text: "Forward a suspicious message, link or screenshot. Get a verdict and what to do next.", href: "/shield", rot: -6, shift: 0 },
  { icon: HeartPulse, title: "Health & backup", text: "Live status, automatic tickets with an SLA, and a backup link that keeps billing running.", href: "/solutions", rot: 3, shift: 1 },
  { icon: Store, title: "Branch-in-a-Box", text: "Opening a second shop? Copy your setup and reuse your KYC in one tap.", href: "/solutions", rot: -4, shift: 0.5 },
];
const RIGHT: Tool[] = [
  { icon: Radar, title: "Network Reality Check", text: "See what can be installed at your pincode before you pay. No fibre? We switch you to 5G AirFiber.", href: "/network", rot: 5, shift: 0 },
  { icon: CalendarClock, title: "Installation slots", text: "Book and reschedule the technician visit yourself. Two free reschedules.", href: "/help", rot: -3, shift: 1 },
  { icon: MessageCircle, title: "Everything in chat", text: "SHIELD, NETWORK, SCHEDULE, TROUBLE, BRANCH and BACKUP work in WhatsApp and Telegram.", href: "/whatsapp", rot: 4, shift: 0.5 },
];

function Card({ t, i, side }: { t: Tool; i: number; side: "l" | "r" }) {
  const Icon = t.icon;
  return (
    <li className="flex" style={{ justifyContent: side === "l" ? "flex-end" : "flex-start" }}>
      <Reveal delay={i * 110} className="w-full max-w-[17.5rem]">
        <Link
          href={t.href}
          className="float-card block rounded-[1.5rem] border border-white/70 bg-[#f8f8ff] p-5 text-ink shadow-[0_22px_40px_-18px_rgb(60_0_0/0.55)] transition-shadow hover:shadow-[0_28px_50px_-18px_rgb(60_0_0/0.7)]"
          style={{ ["--r" as string]: `${t.rot}deg`, ["--x" as string]: `${side === "l" ? t.shift : -t.shift}rem`, animationDelay: `${i * -1.7}s` }}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e6e6fb] text-ink"><Icon size={22} strokeWidth={2.1} /></span>
          <h3 className="mt-3 text-[1.05rem] leading-tight font-extrabold">{t.title}</h3>
          <p className="mt-1 text-[0.92rem] leading-snug text-ink-soft">{t.text}</p>
        </Link>
      </Reveal>
    </li>
  );
}

/** "Beyond the sale": the tools as tilted cards floating around a phone, on a red field with a curved top edge. */
export function ToolsStage() {
  return (
    <section aria-labelledby="tools" className="relative overflow-hidden bg-brand text-white">
      <svg aria-hidden viewBox="0 0 1440 90" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[clamp(36px,6vw,90px)] w-full">
        <path d="M0 0H1440V20Q720 160 0 20Z" fill="#fff" />
      </svg>
      <div aria-hidden className="absolute top-[38%] left-1/2 aspect-square w-[min(120vw,60rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.16),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-[clamp(5rem,10vw,8rem)] pb-[clamp(3.5rem,7vw,6rem)]">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold tracking-[0.16em] text-white/80 uppercase">Beyond the sale</div>
          <h2 id="tools" className="mt-2 text-[clamp(1.7rem,4vw,2.6rem)] leading-tight font-extrabold tracking-tight text-balance">Tools that keep your business running</h2>
          <p className="mt-3 text-lg text-white/85">Free to try, no sign-up. They also work as commands in WhatsApp and Telegram.</p>
        </Reveal>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
          <Reveal className="mx-auto lg:order-2" delay={80}>
            <PhoneMock src="/screens/shield.png" alt="Scam Shield on a phone" className="float-slow" style={{ height: "min(34rem, 68dvh)", rotate: "-3deg" }} />
          </Reveal>
          <ul className="grid gap-5 sm:grid-cols-2 lg:order-1 lg:grid-cols-1 lg:gap-6">
            {LEFT.map((t, i) => <Card key={t.title} t={t} i={i} side="l" />)}
          </ul>
          <ul className="grid gap-5 sm:grid-cols-2 lg:order-3 lg:grid-cols-1 lg:gap-6">
            {RIGHT.map((t, i) => <Card key={t.title} t={t} i={i + 3} side="r" />)}
          </ul>
        </div>
      </div>
    </section>
  );
}
