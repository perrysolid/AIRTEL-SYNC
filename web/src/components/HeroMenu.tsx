"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Languages, Menu, MessageCircle, Send, X } from "lucide-react";
import { LANGUAGES } from "@/lib/advisor-types";

const LINKS: [string, string][] = [
  ["Solutions", "/solutions"],
  ["Products", "/products"],
  ["How it works", "/how-it-works"],
  ["Scam Shield", "/shield"],
  ["Network check", "/network"],
  ["Track your order", "/#track"],
  ["Help", "/help"],
  ["Partner console", "/console"],
];

/** The hamburger in the hero's top-right corner: every link, the chat channels and a single Languages tab. */
export function HeroMenu({ lang, onLang, telegram }: { lang: string; onLang: (code: string) => void; telegram: string }) {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="drawer absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col bg-[#0b0f1f] text-white shadow-[-20px_0_60px_-20px_rgb(0_0_0/0.8)]">
            <div className="flex h-[4.5rem] items-center justify-between border-b border-white/10 px-5">
              <span className="text-sm font-bold tracking-[0.14em] text-white/60 uppercase">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-full border border-white/20 hover:bg-white/10" autoFocus>
                <X size={20} />
              </button>
            </div>

            <nav aria-label="Site" className="flex-1 overflow-y-auto px-3 py-3">
              <ul>
                {LINKS.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-[17px] font-semibold text-white/90 hover:bg-white/10 hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-2 border-t border-white/10 pt-2">
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  aria-expanded={langOpen}
                  aria-controls="menu-languages"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[17px] font-semibold text-white/90 hover:bg-white/10"
                >
                  <Languages size={19} className="text-white/60" />
                  <span className="flex-1">Languages</span>
                  <span lang={lang} className="text-sm font-medium text-white/55">{current?.native}</span>
                  <ChevronDown size={18} className={`text-white/60 transition-transform ${langOpen ? "rotate-180" : ""}`} />
                </button>
                {langOpen && (
                  <ul id="menu-languages" className="grid grid-cols-2 gap-2 px-3 pt-1 pb-3">
                    {LANGUAGES.map((l) => (
                      <li key={l.code}>
                        <button
                          onClick={() => onLang(l.code)}
                          aria-pressed={lang === l.code}
                          lang={l.code}
                          className={`w-full rounded-lg border px-3 py-2 text-[15px] ${lang === l.code ? "border-brand bg-brand font-bold text-white" : "border-white/15 bg-white/5 text-white/85 hover:bg-white/10"}`}
                        >
                          {l.native}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </nav>

            <div className="grid gap-2 border-t border-white/10 p-4">
              <Link href={`/whatsapp?lang=${lang}`} onClick={() => setOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-semibold text-[#7be0b4] hover:bg-white/15">
                <MessageCircle size={18} /> Continue on WhatsApp
              </Link>
              <a href={`https://t.me/${telegram}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-semibold text-[#8fd3ff] hover:bg-white/15">
                <Send size={18} /> Chat on Telegram
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
