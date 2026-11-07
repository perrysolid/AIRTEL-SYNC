import Link from "next/link";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-ink" aria-label="Accel Business home">
      <svg viewBox="0 0 64 64" className={small ? "h-7 w-7" : "h-9 w-9"} aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--ink)" />
        <path d="M18 46 32 16l14 30h-8l-6-14-6 14z" fill="var(--marigold)" />
      </svg>
      <span className={small ? "text-lg leading-none" : "text-xl leading-none"}>
        Accel <span className="font-medium text-ink-soft">Business</span>
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
