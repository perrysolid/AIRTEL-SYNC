"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { LANGUAGES } from "@/lib/advisor-types";

/** Top-right language switch: shows the current language in its own script, opens a list of all ten. */
export function LangPicker({ lang, onLang, onDark = false }: { lang: string; onLang: (code: string) => void; onDark?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const base = onDark ? "border-white/25 bg-white/10 text-white hover:bg-white/20 backdrop-blur" : "border-rule bg-sheet text-ink hover:bg-paper";
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" aria-label={`Language: ${current.name}`} className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition-colors ${base}`}>
        <Languages size={16} />
        <span lang={current.code} className="hidden max-w-[7ch] truncate sm:inline">{current.native}</span>
        <span className="sm:hidden">{current.code.toUpperCase()}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label="Choose your language" className="chip-in absolute top-12 right-0 z-50 grid w-56 grid-cols-2 gap-1 rounded-2xl border border-rule bg-sheet p-2 text-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                role="option"
                aria-selected={l.code === lang}
                onClick={() => {
                  onLang(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-1 rounded-xl px-2.5 py-2 text-left text-[15px] ${l.code === lang ? "bg-brand-soft font-bold text-brand" : "hover:bg-paper"}`}
              >
                <span lang={l.code}>{l.native}</span>
                {l.code === lang && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
