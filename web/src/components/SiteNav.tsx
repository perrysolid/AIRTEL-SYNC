"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Brand";

/** Slim red campaign strip across the very top, the way telecom brands announce what's new. */
export function PromoBar() {
  return (
    <div className="bg-brand text-white">
      <Link href="/shield" className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-[13px] font-semibold hover:underline">
        <span aria-hidden>🛡️</span> New: Scam Shield. Check any suspicious message, link or screenshot, free. <span className="hidden underline underline-offset-2 sm:inline">Check now →</span>
      </Link>
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
          <Link href="/advisor" className="rounded-full bg-brand px-4 py-2 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_var(--brand-deep)] transition-transform hover:-translate-y-0.5">Get my plan</Link>
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

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-4 border-t-brand bg-[#1b1b1b] text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="text-lg font-extrabold text-white"><span className="text-[#ff4d4d]">accel</span> <span className="font-medium text-white/60">business</span></div>
          <p className="mt-2 max-w-xs text-sm">One plan, one bill, live in days. Built for the small businesses that keep India running.</p>
          <p className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Prototype · all data is synthetic</p>
        </div>
        {[
          ["Explore", [["Solutions", "/solutions"], ["Products", "/products"], ["How it works", "/how-it-works"], ["Talk to the advisor", "/advisor"]]],
          ["Tools", [["Scam Shield", "/shield"], ["Network check", "/network"], ["WhatsApp", "/whatsapp"], ["Track an order", "/#track"]]],
          ["Company", [["Help centre", "/help"], ["Privacy & security", "/privacy"], ["Partner console", "/console"]]],
        ].map(([title, links]) => (
          <div key={title as string}>
            <div className="font-bold text-white">{title as string}</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(links as [string, string][]).map(([l, h]) => (
                <li key={h}><Link href={h} className="hover:text-white hover:underline">{l}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">Accel Telecom is a fictional operator built for the YTL Hackathon 2026 · not real company data</div>
    </footer>
  );
}

/** Standard page chrome for the marketing and tool pages. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
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
