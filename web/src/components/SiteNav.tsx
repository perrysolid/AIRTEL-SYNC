"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUp, Menu, X } from "lucide-react";
import { Logo } from "./Brand";
import { AccountButton } from "./Account";

const PROMOS: { icon: string; text: string; cta: string; href: string }[] = [
  { icon: "🛡️", text: "New: Scam Shield. Check any suspicious message, link or screenshot, free.", cta: "Check now", href: "/shield" },
  { icon: "📡", text: "Will it work at your address? See fibre or 5G AirFiber for your pincode before you pay.", cta: "Check pincode", href: "/network" },
  { icon: "🏪", text: "Opening a second shop? Branch-in-a-Box copies your setup and reuses your KYC.", cta: "See how", href: "/solutions" },
  { icon: "💬", text: "Type SHIELD, NETWORK or STATUS on WhatsApp or Telegram. No app to install.", cta: "Open chat", href: "/whatsapp" },
];

/**
 * Slim red campaign strip across the very top, the way telecom brands announce what's new. It rolls through the
 * announcements every few seconds, pauses while hovered or focused, and holds still for reduced motion.
 */
export function PromoBar() {
  const [k, setK] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setK((i) => (i + 1) % PROMOS.length), 4000);
    return () => clearTimeout(t);
  }, [k, paused]);

  return (
    <div
      className="relative h-8 overflow-hidden bg-brand text-white"
      role="region"
      aria-roledescription="carousel"
      aria-label="Announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {PROMOS.map((p, i) => (
        <Link
          key={p.href}
          href={p.href}
          aria-hidden={i !== k}
          tabIndex={i === k ? 0 : -1}
          className="promo-slide absolute inset-0 mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 text-center text-[13px] font-semibold hover:underline"
          style={{ transform: `translateY(${(i - k) * 100}%)`, opacity: i === k ? 1 : 0 }}
        >
          <span aria-hidden>{p.icon}</span>
          <span className="truncate">{p.text}</span>
          <span className="hidden shrink-0 underline underline-offset-2 sm:inline">{p.cta} →</span>
        </Link>
      ))}
      <div className="absolute top-1/2 right-3 hidden -translate-y-1/2 gap-1 md:flex" aria-hidden>
        {PROMOS.map((p, i) => <span key={p.href} className={`h-1.5 rounded-full bg-white transition-all ${i === k ? "w-4 opacity-100" : "w-1.5 opacity-50"}`} />)}
      </div>
    </div>
  );
}

export const NAV_LINKS: [string, string][] = [
  ["Solutions", "/solutions"],
  ["Products", "/products"],
  ["How it works", "/how-it-works"],
  ["Scam Shield", "/shield"],
  ["Network check", "/network"],
  ["Help", "/help"],
];

/** Header for the marketing and tool pages: the logo, the main links, and a way into the advisor. */
export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-sheet/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo small />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 text-[15px] font-semibold transition-colors ${path === href ? "bg-brand text-white" : "text-ink-soft hover:bg-paper hover:text-ink"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AccountButton />
          <Link href="/advisor" className="rounded-full bg-brand px-4 py-2 text-sm font-extrabold whitespace-nowrap text-white shadow-[0_8px_20px_-10px_var(--brand-deep)] transition-transform hover:-translate-y-0.5">Get my plan</Link>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-rule lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-rule bg-sheet px-4 py-3 lg:hidden">
          <ul className="grid gap-1">
            {[...NAV_LINKS, ["Partner console", "/console"] as [string, string], ["WhatsApp", "/whatsapp"] as [string, string]].map(([label, href]) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} className={`block rounded-xl px-3 py-2.5 font-semibold ${path === href ? "bg-paper" : ""}`}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

const FOOTER_COLUMNS: [string, [string, string][]][] = [
  ["Explore", [["Solutions", "/solutions"], ["Products", "/products"], ["How it works", "/how-it-works"], ["Talk to the advisor", "/advisor"]]],
  ["Tools", [["Scam Shield", "/shield"], ["Network check", "/network"], ["WhatsApp chat", "/whatsapp"], ["My plan & order status", "/track"]]],
  ["Support", [["Help centre", "/help"], ["Install slots", "/help"], ["Privacy & security", "/privacy"], ["Partner console", "/console"]]],
];

const CHAT_COMMANDS = ["SHIELD", "NETWORK 411016", "SCHEDULE", "TROUBLE", "BRANCH", "BACKUP", "STATUS"];

/** Site footer: a call to action, the link columns, the chat commands, and the small print. */
export function SiteFooter() {
  return (
    <footer className="bg-[#141414] text-white/70">
      <div className="border-b border-white/10 bg-[linear-gradient(100deg,#e40000,#a30000)] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-4 py-9 sm:flex-row sm:items-center">
          <div>
            <div className="text-2xl leading-tight font-extrabold tracking-tight">Ready to get your shop connected?</div>
            <p className="mt-1 text-white/85">Tell the advisor about your business. A priced plan in about a minute.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/advisor" className="inline-flex h-11 items-center rounded-full bg-white px-6 font-extrabold text-brand transition-transform hover:-translate-y-0.5">Get my plan</Link>
            <Link href="/whatsapp" className="inline-flex h-11 items-center rounded-full border border-white/50 px-6 font-semibold transition-transform hover:-translate-y-0.5 hover:bg-white/10">Continue on WhatsApp</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.25fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo onDark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">One plan, one bill, live in days. Internet, business numbers, billing and CCTV for the small businesses that keep India running.</p>
          <ul className="mt-5 grid gap-2 text-sm">
            {["DPDP-aligned, per-purpose consent", "Documents are read once, never stored", "Every update on WhatsApp or Telegram"].map((t) => (
              <li key={t} className="flex items-start gap-2"><span aria-hidden className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{t}</li>
            ))}
          </ul>
        </div>

        {FOOTER_COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <div className="text-sm font-bold tracking-[0.12em] text-white uppercase">{title}</div>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {links.map(([l, h]) => (
                <li key={l}><Link href={h} className="transition-colors hover:text-white hover:underline hover:underline-offset-4">{l}</Link></li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <div className="text-sm font-bold tracking-[0.12em] text-white uppercase">Type it in chat</div>
          <p className="mt-4 text-sm">These work on WhatsApp and Telegram, no app to install.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CHAT_COMMANDS.map((c) => (
              <li key={c} className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-xs text-white/85">{c}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-5 text-xs sm:flex-row sm:items-center">
          <p className="max-w-2xl leading-relaxed text-white/55">© 2026 Accel Telecom. A fictional operator built for the YTL Hackathon 2026. Prototype: all business data is synthetic, not real company data.</p>
          <div className="flex items-center gap-5 text-white/70">
            <Link href="/privacy" className="hover:text-white hover:underline">Privacy &amp; security</Link>
            <Link href="/help" className="hover:text-white hover:underline">Help</Link>
            <a href="#top" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 font-semibold text-white hover:bg-white/10"><ArrowUp size={13} /> Back to top</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Standard page chrome for the marketing and tool pages. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" className="min-h-dvh">
      <PromoBar />
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 pt-8">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({ eyebrow, title, sub, dark = true }: { eyebrow: string; title: string; sub?: string; dark?: boolean }) {
  return (
    <section className={`rise overflow-hidden rounded-[1.75rem] px-6 py-10 sm:px-10 sm:py-12 ${dark ? "bg-brand text-white" : "card"}`}>
      <div className={`text-xs font-bold tracking-[0.14em] uppercase ${dark ? "text-white/85" : "text-brand"}`}>{eyebrow}</div>
      <h1 className="mt-2 max-w-3xl text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">{title}</h1>
      {sub && <p className={`mt-3 max-w-2xl text-lg ${dark ? "text-white/75" : "text-ink-soft"}`}>{sub}</p>}
    </section>
  );
}
