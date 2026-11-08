"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ban, Clock, Loader2, MessageSquareText } from "lucide-react";
import { TopBar } from "@/components/Brand";
import { Bill } from "@/components/Bill";
import type { Quote, Term } from "@/lib/pricing";
import type { Recommendation } from "@/lib/recommend";
import type { Profile } from "@/lib/profile";
import { inr } from "@/lib/format";
import { Shop3D, VISUAL_LABEL } from "@/components/shop/Shop3D";
import { NetworkCard } from "@/components/NetworkCard";

interface State {
  quote: Quote;
  recommendation: Recommendation;
  profile: Profile;
}

export default function QuotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<State>();
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [term, setTerm] = useState<Term>();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ contactName: "", phone: "", partnerCode: "" });
  const [placing, setPlacing] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id, toggles, quantities: qty, term }) });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Couldn't load your quote");
      else setData(j);
    })();
  }, [id, toggles, qty, term, rev]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg">{error === "No bundle yet" ? "This plan isn't ready yet." : error}</p>
        <Link href="/advisor" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 font-semibold text-white">Talk to the advisor</Link>
      </main>
    );
  }
  if (!data) return <div className="grid h-dvh place-items-center text-ink-soft"><Loader2 className="animate-spin" /></div>;

  const { quote, recommendation, profile } = data;
  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    setError("");
    const r = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id, ...form, partnerCode: form.partnerCode || undefined }) });
    const j = await r.json();
    setPlacing(false);
    if (!r.ok) return setError(j.error);
    router.push(`/order/${j.orderId}`);
  };

  return (
    <div className="min-h-dvh pb-16">
      <TopBar wide>
        <Link href={`/advisor`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft"><MessageSquareText size={16} /> Ask the advisor</Link>
      </TopBar>
      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)]">
          <h1 className="rise mt-6 text-3xl font-extrabold tracking-tight lg:text-4xl">Your plan, line by line</h1>
          <p className="rise mt-1 max-w-md text-ink-soft" style={{ ["--i" as string]: 1 }}>Switch add-ons on or off, change quantities, and pick how long you want to commit. Your shop and the total update instantly.</p>
          <div className="rise card relative mt-5 h-64 overflow-hidden sm:h-80 lg:h-[calc(100%-9.5rem)]" style={{ ["--i" as string]: 2 }}>
            <Shop3D variant="kit" items={quote.lines.filter((l) => l.active && !l.blockedReason).map((l) => l.productId)} className="absolute inset-0" />
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
              <ul className="flex flex-wrap gap-1.5">
                {quote.lines.filter((l) => l.active && !l.blockedReason).map((l) => (
                  <li key={l.productId} className="chip-in rounded-full border border-rule bg-sheet/90 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">{VISUAL_LABEL[l.productId] ?? l.name}</li>
                ))}
              </ul>
              <div className="shrink-0 rounded-2xl bg-brand px-4 py-2 text-right text-white shadow-[var(--shadow-lift)]">
                <div className="text-xs opacity-70">per month + GST</div>
                <div key={quote.monthly} className="chip-in text-2xl font-extrabold tabular-nums">{inr(quote.monthly)}</div>
              </div>
            </div>
          </div>
        </aside>
        <div className="min-w-0 lg:pt-6">

        <NetworkCard sessionId={id} initialPin={profile.pincode} onChanged={() => { setToggles({}); setQty({}); setRev((r) => r + 1); }} />

        <fieldset className="mt-6 lg:mt-6">
          <legend className="mb-2 font-semibold">How long do you want to commit?</legend>
          <div className="grid grid-cols-3 gap-2">
            {([12, 24, 36] as Term[]).map((t) => {
              const allowed = quote.allowedTerms.includes(t);
              return (
                <button
                  key={t}
                  disabled={!allowed}
                  onClick={() => setTerm(t)}
                  aria-pressed={quote.term === t}
                  className={`rounded-xl border px-2 py-2.5 text-center disabled:opacity-40 ${quote.term === t ? "border-brand bg-brand text-white" : "border-rule bg-sheet"}`}
                >
                  <div className="text-lg font-bold">{t} months</div>
                  <div className={`text-xs ${quote.term === t ? "text-white/80" : "text-ink-soft"}`}>{t === 12 ? "standard price" : t === 24 ? "lower price, ½ setup" : "lowest price, no setup"}</div>
                </button>
              );
            })}
          </div>
          {quote.allowedTerms[0] > 12 && <p className="mt-2 text-sm text-ink-soft">Some products in your plan need at least {quote.allowedTerms[0]} months.</p>}
        </fieldset>

        <div className="mt-6">
          <Bill
            quote={quote}
            businessName={profile.businessName}
            onToggle={(pid, on) => setToggles((t) => ({ ...t, [pid]: on }))}
            onQty={(pid, n) => setQty((q) => ({ ...q, [pid]: Math.max(1, n) }))}
          />
        </div>

        <section className="mt-6 flex items-start gap-3 rounded-xl border border-rule bg-sheet p-4">
          <Clock className="mt-0.5 shrink-0" size={20} />
          <div>
            <div className="font-semibold">First services live in {quote.firstLiveInDays <= 1 ? "1 day" : `${quote.firstLiveInDays} days`}, everything in {quote.allLiveInDays} days</div>
            <div className="text-sm text-ink-soft">Mobile lines and apps switch on as soon as you&apos;re verified. Internet follows. You&apos;ll get WhatsApp updates at every step — no need to call us.</div>
          </div>
        </section>

        {(recommendation.excluded.length > 0 || recommendation.notes.length > 0) && (
          <section className="mt-4 rounded-xl border border-rule bg-sheet p-4">
            <h2 className="font-semibold">Not in your plan, and why</h2>
            <ul className="mt-2 space-y-2 text-[15px]">
              {recommendation.excluded.map((e) => (
                <li key={e.productId} className="flex gap-2">
                  <Ban size={16} className="mt-1 shrink-0 text-bad" />
                  <span>
                    {e.reason}.{e.alternative && <span className="text-ink-soft"> Instead: {e.alternative}.</span>}
                  </span>
                </li>
              ))}
              {recommendation.notes.map((n) => (
                <li key={n} className="text-ink-soft">{n}</li>
              ))}
            </ul>
          </section>
        )}

        {recommendation.assumptions.length > 0 && (
          <p className="mt-3 text-sm text-ink-soft">{recommendation.assumptions.join(". ")}.</p>
        )}

        <form onSubmit={placeOrder} className="mt-8 rounded-xl border-2 border-brand bg-sheet p-4">
          <h2 className="text-xl font-extrabold">Get started for {inr(quote.monthlyWithGst)}/month</h2>
          <p className="text-sm text-ink-soft">Next you&apos;ll verify your business in about 2 minutes. Nothing is charged until you approve.</p>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm font-semibold">Your name</span>
              <input required minLength={2} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2.5" autoComplete="name" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Mobile number for WhatsApp updates</span>
              <input required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98xxxxxxxx" className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2.5" autoComplete="tel" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Partner code <span className="font-normal text-ink-soft">(if a shop or agent helped you)</span></span>
              <input value={form.partnerCode} onChange={(e) => setForm({ ...form, partnerCode: e.target.value })} className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 uppercase" />
            </label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-bad">{error}</p>}
          <button disabled={placing} className="mt-4 w-full rounded-xl bg-brand px-4 py-3.5 text-lg font-extrabold text-white disabled:opacity-60">
            {placing ? "Creating your order…" : "Continue to verification"}
          </button>
        </form>
        </div>
      </main>
    </div>
  );
}
