import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { summarize } from "@/lib/advisor";
import { callQueue, demoPhone, listStaff, outreachFor, type LeadView } from "@/lib/crm";
import { requireStaff } from "@/lib/staff-session";
import { store } from "@/lib/store";
import { PageHead, Panel, ScoreBadge, StatusBadge, when } from "../ui";

function Row({ l, owner }: { l: LeadView; owner?: string }) {
  const out = outreachFor(l.row);
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <Link href={`/sales/leads/${l.id}`} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{l.row.business_name}</span>
          <ScoreBadge p={l.score.probability} band={l.score.band} />
          <StatusBadge s={l.status} />
        </div>
        <div className="mt-0.5 text-sm text-ink-soft">
          {l.row.contact_name} ({l.row.contact_role}), {l.row.business_type}, {l.row.city}, speaks {l.row.preferred_language}
          {owner && `, ${owner}`}
        </div>
        <div className="mt-1 text-sm">
          {l.nextAt ? (
            <span className={new Date(l.nextAt).getTime() < Date.now() ? "font-semibold text-bad" : "font-semibold text-marigold-deep"}>Follow-up {when(l.nextAt)}</span>
          ) : (
            <span className="text-ink-soft">Dropped at {l.row.stage_reached.toLowerCase()}: {l.row.drop_reason.toLowerCase()}</span>
          )}
          {l.lastTouch?.note && l.lastTouch.note !== "Sample activity" && <span className="text-ink-soft">. Last note: “{l.lastTouch.note.slice(0, 80)}”</span>}
        </div>
      </Link>
      <div className="flex gap-2">
        <a href={`tel:${demoPhone(l.id).replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"><Phone size={15} /> Call</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(out.message)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-sheet px-4 py-2 text-sm font-semibold"><MessageCircle size={15} className="text-wa" /> Send link</a>
        <Link href={`/sales/leads/${l.id}#log`} className="inline-flex items-center rounded-full border border-rule bg-sheet px-4 py-2 text-sm font-semibold">Log</Link>
      </div>
    </li>
  );
}

export default async function Calls() {
  const staff = await requireStaff();
  const q = await callQueue(staff);
  const names = new Map((await listStaff()).map((s) => [s.id, s.name.split(" (")[0]]));
  const handoffs = staff.role === "partner" ? [] : store
    .listSessions()
    .filter((s) => s.status === "handoff" || (s.status === "quoted" && Date.now() - new Date(s.updatedAt).getTime() > 30 * 60_000))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title="Who to call today" sub={`${q.due.length} follow-ups due, then the ${q.fresh.length} best untouched leads out of ${q.openTotal.toLocaleString("en-IN")} open. Ranked by chance to activate.`} />

      {handoffs.length > 0 && (
        <Panel className="mt-8" title="Owners waiting for a person" sub="The advisor handed these chats over, or the owner got a quote and stopped">
          <ul className="-mx-5 -mb-5 divide-y divide-rule border-t border-rule">
            {handoffs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="font-semibold">{s.profile.businessName ?? s.profile.businessType ?? "New business"}{s.profile.city ? `, ${s.profile.city}` : ""}</div>
                  <div className="text-sm text-ink-soft">{s.handoff?.reason ?? "Got a quote but didn't order"}. {s.handoff?.summary || summarize(s)}</div>
                </div>
                <span className="text-sm text-ink-soft">{s.channel}, {when(s.updatedAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="mt-6" title={`Follow-ups due (${q.due.length})`} sub="Promised call-backs, oldest first">
        <ul className="-mx-5 -mb-5 divide-y divide-rule border-t border-rule">
          {q.due.map((l) => <Row key={l.id} l={l} owner={staff.role === "admin" ? names.get(l.owner) : undefined} />)}
          {!q.due.length && <li className="px-5 py-6 text-ink-soft">No follow-ups due. Work down the list below.</li>}
        </ul>
      </Panel>

      <Panel className="mt-6" title="Best untouched leads" sub="Not called in the last two days, highest chance to activate first">
        <ul className="-mx-5 -mb-5 divide-y divide-rule border-t border-rule">
          {q.fresh.map((l) => <Row key={l.id} l={l} owner={staff.role === "admin" ? names.get(l.owner) : undefined} />)}
        </ul>
      </Panel>
    </div>
  );
}
