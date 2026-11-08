import Link from "next/link";

export function Logo({ small = false, onDark = false }: { small?: boolean; onDark?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-extrabold ${onDark ? "text-white" : "text-ink"}`} aria-label="Accel Business home">
      <svg viewBox="0 0 64 64" className={small ? "h-7 w-7" : "h-9 w-9"} aria-hidden>
        <rect width="64" height="64" rx="16" fill="var(--brand)" />
        <path d="M43 22v22M43 33a11 11 0 1 1-4.2-8.7" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      </svg>
      <span className={small ? "text-lg leading-none tracking-tight" : "text-xl leading-none tracking-tight"}>
        <span className={`font-extrabold ${onDark ? "text-white" : "text-brand"}`}>accel</span> <span className={`font-medium ${onDark ? "text-white/70" : "text-ink-soft"}`}>business</span>
      </span>
    </Link>
  );
}

/** Just the Accel mark (red tile with the white "a"), for places that need the logo without the wordmark. */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path d="M43 22v22M43 33a11 11 0 1 1-4.2-8.7" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  );
}

export function TopBar({ children, wide = false }: { children?: React.ReactNode; wide?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-sheet/75 backdrop-blur-md">
      <div className={`mx-auto flex h-14 items-center justify-between gap-3 px-4 ${wide ? "max-w-6xl" : "max-w-xl"}`}>
        <Logo small />
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
