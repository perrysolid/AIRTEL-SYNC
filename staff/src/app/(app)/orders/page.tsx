"use client";

import Link from "next/link";
import { ago, inr, stageTone, useApi } from "@/lib/api";
import type { OrderRow } from "@/lib/types";
import { Empty, LiveDot, Loading, PageHead } from "@/components/ui";


export default function Orders() {
  const { data } = useApi<{ orders: OrderRow[] }>("/api/staff/orders", 10_000);
  return (
    <>
      <PageHead title="Orders" sub="Move an order on and the owner hears about it on WhatsApp and Telegram straight away." right={<LiveDot />} />
      {!data ? (
        <Loading />
      ) : data.orders.length ? (
        <div className="grid gap-2">
          {data.orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="card grid gap-2 p-4 hover:border-ink/25 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.3fr)] sm:items-center sm:gap-5">
              <div className="min-w-0">
                <div className="truncate font-bold">{o.business}</div>
                <div className="text-sm text-ink-soft">{o.id}{o.city ? ` · ${o.city}` : ""} · {inr(o.monthlyWithGst)}/mo</div>
              </div>
              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${stageTone(o.stage)}`}>{o.stage}</span>
              <div className="min-w-0 text-sm">
                {o.lastUpdate ? <><div className="truncate">{o.lastUpdate.text.split("\n")[0]}</div><div className="text-xs text-ink-soft">{ago(o.lastUpdate.at)} · {o.updates} updates sent</div></> : <span className="text-ink-soft">No updates yet</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty>No orders yet. They appear here the moment an owner orders on the website, WhatsApp or Telegram.</Empty>
      )}
    </>
  );
}
