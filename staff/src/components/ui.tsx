import type { Band } from "@/lib/types";

/** The Accel mark, as on the customer site. */
export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path d="M43 22v22M43 33a11 11 0 1 1-4.2-8.7" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  );
}

const BAND: Record<Band, { label: string; cls: string }> = {
  hot: { label: "Hot", cls: "bg-brand text-white" },
  warm: { label: "Warm", cls: "bg-marigold/20 text-[#7a5300]" },
  cold: { label: "Cold", cls: "bg-paper text-ink-soft" },
};

/** Chance to activate, as a number with its band: the propensity score the call list is sorted by. */
export function Score({ p, band }: { p: number; band: Band }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title="Chance this lead activates if called">
      <span className="tabular text-[15px] font-extrabold">{Math.round(p * 100)}%</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${BAND[band].cls}`}>{BAND[band].label}</span>
    </span>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="tabular mt-1 text-[1.9rem] leading-none font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-ink-soft">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Loading() {
  return (
    <div className="grid gap-3" aria-busy>
      {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />)}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card px-5 py-10 text-center text-ink-soft">{children}</div>;
}

export function LiveDot({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
      </span>
      {label}
    </span>
  );
}

/** WhatsApp and Telegram marks in their own colours. */
export function WhatsAppLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#25D366" d="M12 1.6A10.4 10.4 0 0 0 3 17.2L1.6 22.4l5.3-1.4A10.4 10.4 0 1 0 12 1.6z" />
      <path fill="#fff" d="M9.2 7.4c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.4.3-.5c.1-.2 0-.3 0-.5l-.8-1.8z" />
    </svg>
  );
}
export function TelegramLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10.4" fill="#229ED9" />
      <path fill="#fff" d="M5.6 11.7l10.9-4.2c.5-.2.9.1.8.9l-1.9 8.8c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1l-6.6 4.1-2.8-.9c-.6-.2-.6-.6.2-.9z" />
    </svg>
  );
}
