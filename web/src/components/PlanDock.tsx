"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageCircle, Mic, RotateCcw, X } from "lucide-react";
import { inr } from "@/lib/format";

const WEEK = 7 * 24 * 3600 * 1000;

/**
 * A small dock that follows you down the page once you're past the landing screen, so the next step is always one
 * tap away. If you already built a plan on this device in the last week it offers to continue that plan instead of
 * starting over (people who drop "for lack of time" come back to where they left off).
 */
export function PlanDock({ lang }: { lang: string }) {
  const [plan, setPlan] = useState<{ id: string; monthly?: number }>();
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("accel:plan");
      const p = raw ? (JSON.parse(raw) as { id: string; monthly?: number; at: number }) : undefined;
      if (p?.id && Date.now() - p.at < WEEK) setPlan(p);
    } catch {}
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (closed) return null;
  return (
    <div
      className={`fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-rule bg-white/95 p-1.5 shadow-[0_18px_40px_-16px_rgb(31_31_31/0.45)] backdrop-blur transition-all duration-300 sm:right-6 sm:bottom-6 ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
      aria-hidden={!visible}
    >
      {plan ? (
        <Link href={`/quote/${plan.id}`} className="inline-flex items-center gap-2 rounded-full bg-brand py-2 pr-4 pl-2 text-[14px] font-extrabold text-white">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-brand"><RotateCcw size={15} strokeWidth={2.6} /></span>
          Continue your plan{plan.monthly ? ` · ${inr(plan.monthly)}/mo` : ""}
        </Link>
      ) : (
        <Link href={`/advisor?lang=${lang}&voice=1`} className="inline-flex items-center gap-2 rounded-full bg-brand py-2 pr-4 pl-2 text-[14px] font-extrabold text-white">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-brand"><Mic size={15} strokeWidth={2.6} /></span>
          Get my plan · 1 min
        </Link>
      )}
      <Link href={`/whatsapp?lang=${lang}`} aria-label="Continue on WhatsApp" className="grid h-10 w-10 place-items-center rounded-full bg-[#e7f7ef] text-wa">
        <MessageCircle size={18} />
      </Link>
      <button onClick={() => setClosed(true)} aria-label="Hide" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-paper">
        <X size={15} />
      </button>
    </div>
  );
}
