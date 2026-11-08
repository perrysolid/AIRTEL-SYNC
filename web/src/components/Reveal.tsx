"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades and lifts its children in once, when they scroll into view. `delay` (ms) staggers siblings.
 * Pass `show` to drive it from outside instead (e.g. when a scroll animation decides the moment).
 */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div", show }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li"; show?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (show !== undefined) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  const visible = show ?? seen;
  const Comp = Tag as "div";
  return (
    <Comp ref={ref} data-in={visible ? "" : undefined} className={`reveal ${className}`} style={{ ["--d" as string]: `${delay}ms` }}>
      {children}
    </Comp>
  );
}
