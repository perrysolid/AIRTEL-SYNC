"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, ClipboardCheck, FileSignature, IndianRupee, MessageSquareText, Radio, ReceiptText, ShieldCheck, type LucideIcon } from "lucide-react";

export interface PipeStep {
  key: string;
  label: string;
  done: boolean;
}

const ICON: Record<string, LucideIcon> = {
  talk: MessageSquareText,
  order: ClipboardCheck,
  plan: ReceiptText,
  kyc: ShieldCheck,
  verify: ShieldCheck,
  esign: FileSignature,
  sign: FileSignature,
  payment: IndianRupee,
  pay: IndianRupee,
  live: Radio,
};

/**
 * The order journey as a live pipeline: finished stops fill green, the
 * current one pulses red, and a packet of light runs along the wire toward it.
 */
export function Pipeline({ steps, dark = false, onPick, active: forced }: { steps: PipeStep[]; dark?: boolean; onPick?: (i: number) => void; active?: number }) {
  const reduce = useReducedMotion();
  const firstOpen = steps.findIndex((s) => !s.done);
  const current = forced ?? (firstOpen === -1 ? steps.length - 1 : firstOpen);
  const allDone = firstOpen === -1 && forced === undefined;
  const fill = steps.length > 1 ? Math.min(current, steps.length - 1) / (steps.length - 1) : 1;
  const idle = dark ? "bg-white/10 text-white/60 ring-white/15" : "bg-sheet text-ink-soft ring-rule";

  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progress">
      {/* The wire, behind the stops. Inset by half a column so it runs centre to centre. */}
      <div aria-hidden className="absolute top-5 h-1 rounded-full" style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%`, background: dark ? "rgb(255 255 255 / 0.12)" : "var(--rule)" }}>
        <motion.div
          className="relative h-full overflow-hidden rounded-full"
          style={{ background: allDone ? "var(--signal)" : "linear-gradient(90deg, var(--signal), var(--signal) 70%, var(--brand))" }}
          initial={{ width: reduce ? `${fill * 100}%` : 0 }}
          animate={{ width: `${fill * 100}%` }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {!allDone && <div className="flow absolute inset-0" />}
        </motion.div>
      </div>

      {steps.map((s, i) => {
        const Icon = ICON[s.key] ?? Check;
        const isDone = forced !== undefined ? i < forced : s.done;
        const isNow = i === current && !allDone && !isDone;
        const Tag = onPick ? "button" : "div";
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={isNow ? "step" : undefined}>
            <Tag
              {...(onPick ? { type: "button" as const, onClick: () => onPick(i), "aria-label": s.label } : {})}
              className={`relative grid h-11 w-11 place-items-center rounded-full ring-1 transition-colors duration-500 ${isDone || (allDone && i === current) ? "bg-signal text-white ring-signal" : isNow ? "bg-brand text-white ring-brand" : idle}`}
            >
              {isNow && !reduce && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand/40" />}
              <motion.span key={isDone ? "done" : "todo"} initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} className="relative">
                {isDone ? <Check size={20} strokeWidth={3} /> : <Icon size={19} strokeWidth={2.2} />}
              </motion.span>
            </Tag>
            <span className={`mt-2 px-0.5 text-[12px] leading-tight sm:text-[13px] ${isNow ? "font-bold" : dark ? "text-white/70" : "text-ink-soft"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
