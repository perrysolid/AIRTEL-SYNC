import Link from "next/link";
import { Activity, BadgeCheck, CalendarCheck, IndianRupee, MessageCircle, Sprout } from "lucide-react";
import { PageHero, PageShell } from "@/components/SiteNav";
import { leadSummary } from "@/lib/analytics";
import { DROP_FIXES } from "@/lib/site-content";

export const metadata = { title: "How it works — Accel Business", description: "From “I need internet” to live, in one sitting: six stages, each designed to remove a delay we can see in the data." };

const STAGES: [typeof MessageCircle, string, string, string[]][] = [
  [MessageCircle, "Discover", "Chat or speak to the advisor in your language. It asks about your business, size, location and current setup, then suggests a bundle from the catalogue and explains why. Products that don't fit your city, size or GST status are never offered.", ["Business advisor", "Voice in 10 languages", "Web, WhatsApp or Telegram"]],
  [IndianRupee, "Price", "One transparent monthly price with GST. Switch add-ons on and off, choose 12, 24 or 36 months, and check your pincode. If fibre has not reached you, the bundle switches to 5G AirFiber automatically.", ["Instant quote", "Coverage check", "Savings vs list price"]],
  [BadgeCheck, "Verify", "Consent first, then DigiLocker or photos, registry checks and cross-document checks. You see exactly what passed and what needs a fix, then sign the agreement on your phone.", ["Quick KYC", "Clear consent", "e-Sign"]],
  [CalendarCheck, "Activate", "Pick your own installation slot. SIM and cloud services start right away while hardware ships. Every step shows on a live tracker and arrives in your chat, and you pay only once everything is live.", ["Slot booking", "Live tracker", "Pay after install"]],
  [Activity, "Operate", "Service health, outage alerts, tickets with an SLA, a backup link and a troubleshooter in chat. Scam Shield checks anything suspicious you receive.", ["Health & backup", "Scam Shield", "Troubleshooter"]],
  [Sprout, "Grow", "Open a new branch by copying your setup. Upgrades are suggested as you grow, and your documents stay in one place.", ["New branch in a day", "Upgrades as you grow", "One bill"]],
];

export default function HowItWorksPage() {
  const byReason = new Map<string, number>();
  for (const d of leadSummary().dropReasons) byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + d.count);
  return (
    <PageShell>
      <PageHero eyebrow="How it works" title="From “I need internet” to live, in one sitting" sub="Six stages, each designed to remove a delay we can see in the data." />
      <ol className="mt-8 space-y-0">
        {STAGES.map(([Icon, title, text, tags], i) => (
          <li key={title} className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-5 pb-8 last:pb-0">
            {i < STAGES.length - 1 && <span aria-hidden className="absolute top-14 bottom-0 left-7 w-0.5 bg-rule" />}
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-[var(--shadow-card)]" aria-hidden><Icon size={24} strokeWidth={2} /></div>
            <div>
              <div className="text-xs font-bold tracking-wider text-brand uppercase">Stage {i + 1}</div>
              <h2 className="text-2xl font-extrabold">{title}</h2>
              <p className="mt-1 text-ink-soft">{text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="rounded-md bg-paper px-2 py-1 text-xs font-bold">{t}</span>)}</div>
            </div>
          </li>
        ))}
      </ol>

      <section className="card mt-10 p-6">
        <div className="text-xs font-bold tracking-wider text-brand uppercase">Built from the data</div>
        <h2 className="text-2xl font-extrabold">Every drop-off has a fix</h2>
        <p className="mt-1 text-ink-soft">Only 7.4% of last quarter&apos;s leads activated. These are the reasons prospects gave for dropping out, and what the journey does about each.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[15px]">
            <thead><tr className="border-b border-rule text-xs tracking-wider text-ink-soft uppercase"><th className="py-2 pr-3">Why they dropped</th><th className="py-2 pr-3">Leads lost</th><th className="py-2">What the journey does</th></tr></thead>
            <tbody>
              {DROP_FIXES.map((f) => (
                <tr key={f.reason} className="border-b border-rule/60 align-top"><td className="py-3 pr-3 font-bold">{f.reason}</td><td className="py-3 pr-3 tabular-nums">{(byReason.get(f.reason) ?? 0).toLocaleString("en-IN")}</td><td className="py-3 text-ink-soft">{f.fix}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-soft">Source: the lead file, Apr–Jun 2026 (synthetic). The fixes are our design; their effect on conversion is a target, not a measured result.</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5"><h3 className="text-lg font-bold">Prices nobody can bend</h3><p className="mt-1 text-ink-soft">Say it however you like, in your language. Prices and what you can get always come from Accel&apos;s published price list. If something needs a GST number or an internet line first, the advisor tells you why it left it out. Nothing is added without you seeing it.</p></div>
        <div className="card p-5"><h3 className="text-lg font-bold">People stay in the loop</h3><p className="mt-1 text-ink-soft">When the advisor can&apos;t close a lead, or you ask for a person, a local partner gets the whole conversation. Dedicated links include a site-survey video call with a field engineer.</p></div>
      </section>
      <div className="mt-8 text-center"><Link href="/advisor" className="inline-block rounded-full bg-brand px-7 py-3.5 text-lg font-extrabold text-white">Start with the advisor</Link></div>
    </PageShell>
  );
}
