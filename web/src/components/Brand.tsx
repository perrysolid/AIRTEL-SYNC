import Link from "next/link";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-ink" aria-label="Accel Business home">
      <svg viewBox="0 0 64 64" className={small ? "h-7 w-7" : "h-9 w-9"} aria-hidden>
        <rect width="64" height="64" rx="16" fill="var(--brand)" />
        <path d="M43 22v22M43 33a11 11 0 1 1-4.2-8.7" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      </svg>
      <span className={small ? "text-lg leading-none tracking-tight" : "text-xl leading-none tracking-tight"}>
        <span className="font-extrabold text-brand">accel</span> <span className="font-medium text-ink-soft">business</span>
      </span>
    </Link>
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
