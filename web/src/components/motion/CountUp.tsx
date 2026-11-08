"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";

/**
 * A number that rolls to its new value: from 0 the first time it scrolls into
 * view, then from the old value whenever it changes (toggling an add-on).
 */
export function CountUp({ value, format = inr, duration = 0.9, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const from = useRef(0);
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!seen) return;
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    // Start from wherever the last roll got to, so a quick second change doesn't jump.
    const c = animate(from.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (n) => {
        from.current = n;
        setShown(n);
      },
    });
    return () => c.stop();
  }, [seen, value, reduce, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {format(shown)}
    </span>
  );
}
