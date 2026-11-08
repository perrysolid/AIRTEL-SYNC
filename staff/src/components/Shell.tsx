"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, ClipboardList, LogOut, MessagesSquare, PhoneCall, Smartphone, Sun, Users } from "lucide-react";
import { createContext, useContext } from "react";
import { send, useApi } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Mark } from "./ui";

const MeContext = createContext<Me | undefined>(undefined);
export const useMe = () => useContext(MeContext)!;

type Nav = { href: string; label: string; icon: typeof Sun; roles?: Me["role"][] };
const NAV: Nav[] = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/calls", label: "Calls", icon: PhoneCall },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/chats", label: "Advisor chats", icon: MessagesSquare, roles: ["admin", "sales"] },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/team", label: "Team", icon: BarChart3, roles: ["admin"] },
  { href: "/whatsapp", label: "WhatsApp", icon: Smartphone, roles: ["admin"] },
];

const ROLE: Record<Me["role"], string> = { admin: "Manager", sales: "Field sales", partner: "Channel partner" };

/** Signed-in frame: a sidebar on desktop, a tab bar at the bottom on phones (field staff work from their phones). */
export function Shell({ children }: { children: React.ReactNode }) {
  const { data: me } = useApi<Me>("/api/staff/me", 0);
  const path = usePathname();
  const router = useRouter();
  if (!me) return <div className="grid min-h-dvh place-items-center"><Mark className="h-10 w-10 animate-pulse" /></div>;
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(me.role));
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const signOut = async () => {
    await send("/api/staff/session", "DELETE");
    router.replace("/login");
  };

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule bg-sheet px-3 py-5 lg:flex">
          <Link href="/" className="flex items-center gap-2.5 px-2">
            <Mark />
            <span className="leading-tight">
              <span className="block text-[17px] font-extrabold"><span className="text-brand">accel</span> <span className="font-medium text-ink-soft">business</span></span>
              <span className="block text-xs font-semibold text-ink-soft">{me.role === "admin" ? "Admin console" : me.role === "partner" ? "Partner portal" : "Sales portal"}</span>
            </span>
          </Link>
          <nav className="mt-7 grid gap-0.5" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition-colors ${active(n.href) ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-paper hover:text-ink"}`}>
                <n.icon size={19} /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-paper p-3">
            <div className="font-bold">{me.name}</div>
            <div className="text-sm text-ink-soft">{ROLE[me.role]}{me.region ? `, ${me.region}` : ""}</div>
            <button onClick={signOut} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"><LogOut size={15} /> Sign out</button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-rule bg-sheet/90 px-4 backdrop-blur lg:hidden">
            <Link href="/" className="flex items-center gap-2"><Mark className="h-7 w-7" /><span className="font-extrabold">{me.role === "admin" ? "Admin" : me.role === "partner" ? "Partner" : "Sales"}</span></Link>
            <button onClick={signOut} aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-full border border-rule"><LogOut size={16} /></button>
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
        </div>

        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid border-t border-rule bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active(n.href) ? "text-brand" : "text-ink-soft"}`}>
              <n.icon size={21} /> <span className="truncate">{n.label.split(" ")[0]}</span>
            </Link>
          ))}
        </nav>
      </div>
    </MeContext.Provider>
  );
}
