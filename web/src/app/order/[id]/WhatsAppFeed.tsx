"use client";

import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { PublicOrder } from "@/lib/order-view";

/** The proactive updates the owner receives — the reason they never need to call. */
export function WhatsAppFeed({ order }: { order: PublicOrder }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [order.notifications.length]);

  return (
    <section className="mt-10" aria-label="Updates sent to your WhatsApp">
      <h2 className="flex items-center gap-2 font-bold"><MessageCircle size={18} className="text-wa" /> Updates on your WhatsApp ({order.phone})</h2>
      <div ref={ref} className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-xl bg-wa/10 p-3">
        {order.notifications.map((n, i) => (
          <div key={i} className="max-w-[90%] rounded-lg rounded-tl-none bg-sheet px-3 py-2 text-[15px] shadow-[0_1px_0_var(--rule)]">
            {n.text}
            <div className="mt-0.5 text-right text-[11px] text-ink-soft">{new Date(n.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-soft">Reply STATUS on WhatsApp any time for a live summary.</p>
    </section>
  );
}
