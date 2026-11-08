"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Loader2, LogOut, MessageCircle, Send, Trash2 } from "lucide-react";
import { PageShell } from "@/components/SiteNav";
import { useCustomer, type Me } from "@/components/Account";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function AccountPage() {
  const router = useRouter();
  const { me, refresh } = useCustomer(15_000);
  useEffect(() => {
    if (me === null) router.replace("/login?next=/account");
  }, [me, router]);

  return (
    <PageShell>
      {!me ? (
        <div className="grid place-items-center py-24 text-ink-soft"><Loader2 className="animate-spin" /></div>
      ) : (
        <Dashboard me={me} refresh={refresh} />
      )}
    </PageShell>
  );
}

function Dashboard({ me, refresh }: { me: Me; refresh: () => Promise<void> }) {
  const router = useRouter();
  const updates = me.orders.flatMap((o) => o.updates.map((u) => ({ ...u, orderId: o.id }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const m = me.memory;
  const facts: [string, string][] = [
    ["Business", m.business ?? ""],
    ["City", m.city ?? ""],
    ["Team", m.team ? `${m.team} people` : ""],
    ["GST", m.gst === null ? "" : m.gst ? "Registered" : "Not registered"],
    ["Internet today", m.internetToday ?? ""],
    ["Pays today", m.spendToday ? `${inr(m.spendToday)}/month` : ""],
    ["Budget", m.budget ? `up to ${inr(m.budget)}/month` : ""],
  ].filter(([, v]) => v) as [string, string][];

  async function patch(body: unknown) {
    await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await refresh();
  }

  return (
    <div className="grid gap-6 pb-16">
      <section className="rise rounded-[1.75rem] bg-brand px-6 py-8 text-white sm:px-10">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Namaste{me.name ? `, ${me.name}` : ""}</h1>
        <p className="mt-2 max-w-2xl text-white/80">
          {me.orders[0] ? `Order ${me.orders[0].id}: ${me.orders[0].next ? `next, ${me.orders[0].next.toLowerCase()}` : "everything is live"}.` : me.lastPlan ? `Your plan of ${inr(me.lastPlan.monthlyWithGst)}/month is saved.` : "Tell the advisor about your business and get one plan, one bill."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={me.orders[0] ? `/order/${me.orders[0].id}` : "/advisor"} className="rounded-full bg-white px-5 py-2.5 font-extrabold text-brand">{me.orders[0] ? "Open my order" : me.lastPlan ? "Continue my plan" : "Get my plan"}</Link>
          <Link href="/advisor" className="rounded-full border border-white/40 px-5 py-2.5 font-bold text-white hover:bg-white/10">Ask the advisor</Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">Latest updates</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><span className="live-dot" /> Live</span>
          </div>
          {updates.length ? (
            <ol className="mt-4 grid gap-3">
              {updates.map((u, i) => (
                <li key={`${u.orderId}-${u.at}-${i}`} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0">
                    <p className="whitespace-pre-line">{u.text}</p>
                    <p className="text-xs text-ink-soft">{u.orderId} · {ago(u.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-ink-soft">Updates on your orders appear here and on WhatsApp the moment anything changes.</p>
          )}

          {me.orders.map((o) => (
            <Link key={o.id} href={`/order/${o.id}`} className="mt-5 block rounded-2xl border border-rule p-4 transition-colors hover:bg-paper">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">{o.businessName}</span>
                <span className="text-sm text-ink-soft">{o.id} · {inr(o.monthlyWithGst)}/mo</span>
              </div>
              <div className="mt-3 flex gap-1.5" aria-label={`${o.steps.filter((s) => s.done).length} of ${o.steps.length} steps done`}>
                {o.steps.map((s) => <span key={s.key} title={s.label} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-ok" : "bg-rule"}`} />)}
              </div>
              <div className="mt-2 text-sm text-ink-soft">{o.next ? `Next: ${o.next}` : "All services live"}</div>
            </Link>
          ))}
        </section>

        <div className="grid content-start gap-6">
          <section className="card p-5">
            <h2 className="text-xl font-extrabold">Where updates reach you</h2>
            <Channel
              icon={<MessageCircle size={20} className="text-wa" />}
              title={me.phone ? `WhatsApp · ${me.phone}` : "WhatsApp"}
              on={!me.demo && me.notify.whatsapp}
              disabled={me.demo}
              onToggle={(v) => patch({ notify: { whatsapp: v } })}
              note={me.demo ? <>This is a demo account. <Link href="/login?next=/account" className="font-bold text-wa underline">Sign in with your number</Link> to get updates on WhatsApp.</> : me.whatsappWindowOpen ? "Connected. Updates arrive with your live status card." : (
                <>Say hi to our WhatsApp once so we can send full updates. <a href={me.whatsappLink} target="_blank" rel="noreferrer" className="font-bold text-wa underline">Open WhatsApp</a></>
              )}
            />
            <Channel
              icon={<Send size={20} className="text-[#229ED9]" />}
              title="Telegram"
              on={me.telegramLinked && me.notify.telegram}
              disabled={!me.telegramLinked}
              onToggle={(v) => patch({ notify: { telegram: v } })}
              note={me.telegramLinked ? "Linked." : <TelegramLink />}
            />
          </section>

          <section className="card p-5">
            <h2 className="text-xl font-extrabold">What the advisor remembers</h2>
            <p className="mt-1 text-sm text-ink-soft">So you never have to repeat yourself. It updates as you chat.</p>
            {facts.length || m.needs.length ? (
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {facts.map(([k, v]) => [<dt key={`${k}t`} className="text-ink-soft">{k}</dt>, <dd key={`${k}d`} className="font-semibold">{v}</dd>])}
                {m.needs.length > 0 && [<dt key="nt" className="text-ink-soft">Wants</dt>, <dd key="nd" className="font-semibold">{m.needs.join(", ")}</dd>]}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-ink-soft">Nothing yet. Chat with the advisor and it will remember your business here.</p>
            )}
            {me.lastPlan && (
              <div className="mt-4 rounded-xl bg-paper p-3 text-sm">
                <div className="font-bold">Last plan · {inr(me.lastPlan.monthlyWithGst)}/month incl. GST</div>
                <div className="text-ink-soft">{me.lastPlan.lines.join(", ")}</div>
              </div>
            )}
            <ForgetMe onDone={() => router.replace("/")} />
          </section>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-full border border-rule bg-sheet px-4 py-2.5 font-semibold hover:bg-paper"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/");
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Channel({ icon, title, on, onToggle, note, disabled }: { icon: React.ReactNode; title: string; on: boolean; onToggle: (v: boolean) => void; note: React.ReactNode; disabled?: boolean }) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-ink-soft">{note}</div>
      </div>
      <button role="switch" aria-checked={on} aria-label={`${title} updates`} disabled={disabled} onClick={() => onToggle(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-ok" : "bg-rule"}`}>
        <span className={`absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`}>{on && <Check size={12} className="text-ok" />}</span>
      </button>
    </div>
  );
}

function TelegramLink() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="font-bold text-[#229ED9] underline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/me/telegram");
        if (r.ok) window.open((await r.json()).url, "_blank", "noopener");
        setBusy(false);
      }}
    >
      Get updates on Telegram
    </button>
  );
}

function ForgetMe({ onDone }: { onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="mt-5 rounded-xl border border-bad/30 bg-bad/5 p-3 text-sm">
      <p className="font-semibold">Delete your account and everything the advisor remembers? Your orders stay active.</p>
      <div className="mt-2 flex gap-2">
        <button
          className="rounded-full bg-bad px-4 py-1.5 font-bold text-white"
          onClick={async () => {
            await fetch("/api/me", { method: "DELETE" });
            onDone();
          }}
        >
          Delete
        </button>
        <button className="rounded-full border border-rule px-4 py-1.5 font-semibold" onClick={() => setConfirm(false)}>Keep it</button>
      </div>
    </div>
  ) : (
    <button className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-bad" onClick={() => setConfirm(true)}>
      <Trash2 size={14} /> Forget me
    </button>
  );
}
