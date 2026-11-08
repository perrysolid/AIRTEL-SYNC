"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LineChart, ListChecks, LogOut, PhoneCall, ShoppingBag, Users } from "lucide-react";
import { signOut } from "../actions";

const ROLE = { admin: "Sales manager", sales: "Salesperson", partner: "Channel partner" } as const;

export function SalesNav({ staff }: { staff: { name: string; role: keyof typeof ROLE; region?: string; partnerCode?: string } }) {
  const path = usePathname();
  const links = [
    { href: "/sales", label: "Overview", icon: BarChart3 },
    { href: "/sales/calls", label: "Who to call", icon: PhoneCall },
    { href: "/sales/leads", label: "Lead records", icon: ListChecks },
    { href: "/sales/orders", label: "Orders", icon: ShoppingBag },
    ...(staff.role === "admin" ? [{ href: "/sales/team", label: "Team", icon: Users }] : []),
    ...(staff.role !== "partner" ? [{ href: "/console", label: "Insights & win-back", icon: LineChart }] : []),
  ];
  const active = (h: string) => (h === "/sales" ? path === h : path.startsWith(h));
  return (
    <aside className="night sticky top-0 z-20 lg:h-dvh">
      <div className="flex h-14 items-center justify-between px-4 lg:h-auto lg:flex-col lg:items-stretch lg:gap-8 lg:px-5 lg:pt-7">
        <Link href="/sales" className="flex items-center gap-2.5 font-bold">
          <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
            <rect width="64" height="64" rx="16" fill="#e4002b" />
            <path d="M18 46 32 16l14 30h-8l-6-14-6 14z" fill="#fff" />
          </svg>
          <span>Accel <span className="font-medium text-white/60">Sales</span></span>
        </Link>
        <form action={signOut} className="lg:hidden">
          <button className="inline-flex items-center gap-1.5 text-sm text-white/70"><LogOut size={15} /> Sign out</button>
        </form>
      </div>
      <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-2 lg:flex-col lg:px-3" aria-label="Sales portal">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${active(href) ? "bg-white text-ink" : "text-white/75 hover:bg-white/10"}`}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
      <div className="absolute inset-x-0 bottom-0 hidden p-5 lg:block">
        <div className="glass rounded-2xl p-4">
          <div className="font-semibold">{staff.name}</div>
          <div className="text-sm text-white/60">{ROLE[staff.role]}{staff.region ? `, ${staff.region}` : ""}</div>
          {staff.partnerCode && <div className="mt-1 font-mono text-xs text-white/50">{staff.partnerCode}</div>}
          <form action={signOut} className="mt-3">
            <button className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"><LogOut size={15} /> Sign out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
