"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, UserRound } from "lucide-react";

export interface Me {
  signedIn: true;
  name: string | null;
  phone: string | null;
  demo: boolean;
  language: string | null;
  memory: { business: string | null; city: string | null; team: number | null; gst: boolean | null; internetToday: string | null; spendToday: number | null; budget: number | null; needs: string[]; declined: string[] };
  lastPlan: { monthly: number; monthlyWithGst: number; term: number; lines: string[]; at: string; sessionId: string } | null;
  orders: { id: string; businessName: string; createdAt: string; monthlyWithGst: number; steps: { key: string; label: string; done: boolean }[]; next?: string; updates: { at: string; channel: string; text: string }[] }[];
  notify: { whatsapp: boolean; telegram: boolean };
  telegramLinked: boolean;
  whatsappWindowOpen: boolean;
  whatsappLink: string;
}

/** The signed-in customer, refreshed every `pollMs` so new order updates appear without a reload. */
export function useCustomer(pollMs = 0) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      setMe(r.ok ? ((await r.json()) as Me) : null);
    } catch {
      setMe((m) => m ?? null);
    }
  }, []);
  useEffect(() => {
    void refresh();
    if (!pollMs) return;
    const t = setInterval(() => document.visibilityState === "visible" && void refresh(), pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);
  return { me, refresh };
}

/** Header control: "Sign in" for visitors, the owner's name (and a dot for unread updates) once signed in. */
export function AccountButton({ onDark = false }: { onDark?: boolean }) {
  const { me } = useCustomer();
  if (me === undefined) return <span className="h-10 w-10" aria-hidden />;
  const base = onDark ? "border-white/25 bg-white/10 text-white hover:bg-white/20 backdrop-blur" : "border-rule bg-sheet text-ink hover:bg-paper";
  if (!me)
    return (
      <Link href="/login" aria-label="Sign in" className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold whitespace-nowrap transition-colors sm:px-3.5 ${base}`}>
        <UserRound size={16} /> <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  const fresh = me.orders.some((o) => o.updates[0] && Date.now() - Date.parse(o.updates[0].at) < 24 * 3600_000);
  return (
    <Link href="/account" aria-label={`Your account${fresh ? ", new updates" : ""}`} className={`relative inline-flex h-10 items-center gap-2 rounded-full border pr-1 pl-1 text-sm sm:pr-3.5 font-bold transition-colors ${base}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white">{(me.name ?? "A").slice(0, 1).toUpperCase()}</span>
      <span className="hidden max-w-[9ch] truncate sm:inline">{me.name ?? "Account"}</span>
      {fresh && <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-marigold ring-2 ring-white" />}
    </Link>
  );
}

/** Home page: a returning owner sees their latest update and one tap back into what they were doing. */
export function WelcomeBack() {
  const { me } = useCustomer(20_000);
  if (!me) return null;
  const o = me.orders[0];
  const latest = o?.updates[0];
  return (
    <Link href={o ? `/order/${o.id}` : "/advisor"} className="rise mb-4 inline-flex max-w-[min(40rem,92vw)] items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-left text-sm text-white backdrop-blur-md transition-colors hover:bg-white/15">
      <Bell size={18} className="shrink-0 text-marigold" />
      <span className="min-w-0">
        <span className="block font-bold">Welcome back{me.name ? `, ${me.name}` : ""}</span>
        <span className="block truncate text-white/75">
          {latest ? latest.text : o ? `Order ${o.id}: next, ${o.next?.toLowerCase() ?? "all live"}` : me.lastPlan ? `Your plan of ₹${me.lastPlan.monthlyWithGst.toLocaleString("en-IN")}/month is saved. Pick up where you left off.` : "Tell the advisor what's changed and get a plan in a minute."}
        </span>
      </span>
    </Link>
  );
}
