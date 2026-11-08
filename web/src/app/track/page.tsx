"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle, LogIn, Search } from "lucide-react";
import { PageHero, PageShell } from "@/components/SiteNav";
import { useCustomer } from "@/components/Account";
import { inr } from "@/lib/format";

/**
 * Plan & order status: a signed-in owner sees every order with its progress and latest update; anyone can look an
 * order up by its ID. Each one opens the full live tracker.
 */
export default function TrackPage() {
  const router = useRouter();
  const { me } = useCustomer(15000);
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const orders = me?.orders ?? [];

  return (
    <PageShell>
      <PageHero eyebrow="My plan & order status" title="Track your plan and installation" sub="See where each service is, what happens next, and every update we've sent you. No calls needed." />

      {orders.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold">Your orders</h2>
          <ul className="mt-3 grid gap-4 lg:grid-cols-2">
            {orders.map((o) => {
              const done = o.steps.filter((s) => s.done).length;
              const pct = Math.round((done / Math.max(1, o.steps.length)) * 100);
              return (
                <li key={o.id}>
                  <Link href={`/order/${o.id}`} className="card group block p-5 transition-transform hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold">{o.businessName}</div>
                        <div className="text-sm text-ink-soft"><span className="font-mono">{o.id}</span> · {inr(o.monthlyWithGst)}/month</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pct === 100 ? "bg-ok/15 text-ok" : "bg-brand-soft text-brand"}`}>{pct === 100 ? "All live" : `${pct}% done`}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                    <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {o.steps.map((s) => (
                        <li key={s.key} className={`inline-flex items-center gap-1.5 ${s.done ? "text-ink" : "text-ink-soft"}`}>
                          {s.done ? <CheckCircle2 size={15} className="text-ok" /> : <Circle size={15} />} {s.label}
                        </li>
                      ))}
                    </ol>
                    {o.next && <p className="mt-3 text-sm"><b>Next:</b> {o.next}</p>}
                    {o.updates[0] && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">Latest: {o.updates[0].text}</p>}
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand">Open live tracker <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8 mb-16 grid gap-5 lg:grid-cols-2">
        <form
          className="card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const v = id.trim().toUpperCase();
            if (!/^ACC-[A-Z0-9]{6,}$/.test(v)) return setError("Order IDs look like ACC-3F9A2C71D0. You'll find yours in the WhatsApp or SMS we sent.");
            setError("");
            router.push(`/order/${v}`);
          }}
        >
          <h2 className="text-lg font-extrabold">Look up an order</h2>
          <p className="mt-1 text-sm text-ink-soft">Enter the order ID from your WhatsApp or SMS updates.</p>
          <label htmlFor="track-id" className="sr-only">Order ID</label>
          <div className="mt-3 flex gap-2">
            <input id="track-id" value={id} onChange={(e) => setId(e.target.value)} placeholder="Order ID, e.g. ACC-3F9A2C71D0" className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2.5 uppercase placeholder:normal-case" />
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 font-semibold text-white"><Search size={16} /> Track</button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
        </form>

        {me === null && (
          <div className="card flex flex-col p-5">
            <h2 className="text-lg font-extrabold">See all your orders</h2>
            <p className="mt-1 flex-1 text-sm text-ink-soft">Sign in with your mobile number to see every plan and order in one place, with updates as they happen.</p>
            <Link href="/login" className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-rule px-5 py-2.5 font-semibold hover:bg-paper"><LogIn size={16} /> Sign in</Link>
          </div>
        )}
      </section>
    </PageShell>
  );
}
