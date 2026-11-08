import Link from "next/link";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-ink" aria-label="Accel Business home">
      <svg viewBox="0 0 64 64" className={small ? "h-7 w-7" : "h-9 w-9"} aria-hidden>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5c39" /><stop offset=".55" stopColor="#e4002b" /><stop offset="1" stopColor="#b3001f" /></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)" />
        <path d="M18 46 32 16l14 30h-8l-6-14-6 14z" fill="#fff" />
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
