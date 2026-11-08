import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Phone, Send } from "lucide-react";
import { reassign } from "../../../actions";
import { activityFor, canSee, leadViews, listStaff, outreachFor, STATUSES } from "@/lib/crm";
import { leadPhone } from "@/lib/crm";
import { inr } from "@/lib/format";
import { requireStaff } from "@/lib/staff-session";
import { Panel, StatusBadge, when } from "../../ui";
import { datasets } from "@/lib/data";
import { LogForm } from "./LogForm";

const MILESTONES = [
  ["created_date", "Lead created"],
  ["contacted_date", "First contact"],
  ["needs_assessed_date", "Needs assessed"],
  ["quote_accepted_date", "Quote accepted"],
  ["kyc_complete_date", "KYC complete"],
  ["activated_date", "Activated"],
] as const;

export default async function LeadRecord({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const lead = (await leadViews()).get(id.toUpperCase());
  if (!lead || !canSee(staff, lead)) notFound();
  const r = lead.row;
  const history = await activityFor(lead.id);
  const team = await listStaff();
  const name = (sid: string) => team.find((s) => s.id === sid)?.name ?? sid;
  const out = outreachFor(r);
  const maxEffect = Math.max(...lead.score.reasons.map((x) => Math.abs(x.effect)), 0.01);
  const facts: [string, string][] = [
    ["Contact", `${r.contact_name}, ${r.contact_role}`],
    ["Phone", leadPhone(lead) || "Not given"],
    ["Language", r.preferred_language],
    ["Business", `${r.business_type}, ${r.segment}`],
    ["Location", `${r.city}, ${r.state} (tier ${r.city_tier})`],
    ["Size", `${r.employee_count} staff, ${r.num_sites} site${r.num_sites === "1" ? "" : "s"}`],
    ["Turnover", r.annual_turnover_band],
    ["GSTIN / Udyam", `${r.has_gstin === "Y" ? "GST registered" : "No GSTIN"}, ${r.has_udyam === "Y" ? "Udyam registered" : "no Udyam"}`],
    ["Today", `${r.current_internet} with ${r.current_provider}, ${inr(Number(r.monthly_telecom_spend_inr))}/mo`],
    ["Interested in", r.products_of_interest.split(";").filter(Boolean).map((p) => datasets().catalogue.find((c) => c.product_id === p)?.product_name ?? p).join(", ") || "Not said"],
    ["Source", r.lead_source],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/sales/leads" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft size={15} /> Lead records</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{r.business_name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-ink-soft">
            <span className="font-mono text-sm">{lead.id}</span>
            <StatusBadge s={lead.status} />
            <span>Owner: {name(lead.owner)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${leadPhone(lead).replace(/\s/g, "")}`} className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5"><Phone size={17} /> Call {r.contact_name.split(" ")[0]}</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(out.message)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-5 py-2.5 font-semibold"><MessageCircle size={17} className="text-wa" /> Send plan link</a>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-4">
          <Panel title="Why this score" sub="What moved this lead's chance to activate, from the propensity model">
            <div className="flex items-center gap-4">
              <div className="text-5xl font-extrabold tabular-nums" style={{ fontVariationSettings: '"wdth" 112' }}>{Math.round(lead.score.probability * 100)}%</div>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${lead.score.band === "hot" ? "bg-brand/10 text-brand" : lead.score.band === "warm" ? "bg-marigold/15 text-marigold-deep" : "bg-paper text-ink-soft"}`}>{lead.score.band === "hot" ? "Hot lead" : lead.score.band === "warm" ? "Warm lead" : "Cold lead"}</span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {lead.score.reasons.map((x) => (
                <li key={x.label} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 text-sm">
                  <span>{x.label}</span>
                  <span className="relative h-2 rounded bg-paper" title={x.effect > 0 ? "Raises the chance" : "Lowers the chance"}>
                    <span className={`absolute top-0 h-full rounded ${x.effect > 0 ? "left-1/2 bg-[#1baf7a]" : "right-1/2 bg-[#eb6834]"}`} style={{ width: `${(Math.abs(x.effect) / maxEffect) * 50}%` }} />
                    <span className="absolute top-[-3px] left-1/2 h-[14px] w-px bg-ink-soft/50" />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">Green raises the chance, orange lowers it.</p>
          </Panel>

          <Panel title="Record">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 border-t border-rule pt-4">
              <div className="text-sm font-semibold">Last quarter&apos;s journey</div>
              <ol className="mt-3 flex flex-wrap gap-2 text-xs">
                {MILESTONES.map(([k, label]) => (
                  <li key={k} className={`rounded-full px-2.5 py-1 ${r[k] ? "bg-[#2a78d6]/10 text-[#1d5fae]" : "bg-paper text-ink-soft"}`}>{label}{r[k] ? `, ${r[k]}` : ""}</li>
                ))}
              </ol>
              {r.drop_reason && <p className="mt-3 text-sm"><span className="text-ink-soft">Dropped at {r.stage_reached.toLowerCase()}:</span> {r.drop_reason}</p>}
            </div>
          </Panel>

          <Panel title={`Activity (${history.length})`} sub="Every touch on this lead, newest first">
            <ol className="relative space-y-4 border-l border-rule pl-5">
              {history.map((a) => (
                <li key={a.id} className="relative">
                  <span className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-sheet ${a.outcome === "Connected" || a.status === "won" ? "bg-signal" : a.kind === "assign" ? "bg-ink-soft" : "bg-[#2a78d6]"}`} />
                  <div className="text-sm">
                    <span className="font-semibold">{a.kind === "assign" ? `Reassigned to ${name(a.note)}` : a.kind === "call" ? `Call: ${a.outcome}` : a.kind === "whatsapp" ? "WhatsApp link sent" : "Note"}</span>
                    {a.status && <span className="text-ink-soft">, status {STATUSES[a.status].toLowerCase()}</span>}
                  </div>
                  {a.kind !== "assign" && a.note && <p className="mt-0.5 text-sm">{a.note}</p>}
                  <div className="mt-0.5 text-xs text-ink-soft">{name(a.staffId)}, {new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{a.nextAt ? `. Follow up ${when(a.nextAt)}` : ""}</div>
                </li>
              ))}
              {!history.length && <li className="text-sm text-ink-soft">No activity yet. Log the first call on the right.</li>}
            </ol>
          </Panel>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Log what happened">
            <LogForm leadId={lead.id} />
          </Panel>
          <Panel title="Self-serve link" sub="The owner opens the advisor with this record already filled in">
            <p className="rounded-xl bg-paper p-3 text-sm break-words [overflow-wrap:anywhere]">{out.message}</p>
            <div className="mt-3 flex gap-2 text-sm font-semibold">
              <a href={out.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-wa"><MessageCircle size={15} /> WhatsApp link</a>
              <a href={out.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#1d5fae]"><Send size={15} /> Telegram link</a>
            </div>
          </Panel>
          {staff.role === "admin" && (
            <Panel title="Reassign">
              <form action={reassign} className="flex gap-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <select name="to" defaultValue={lead.owner} className="min-w-0 flex-1 rounded-xl border border-rule bg-sheet px-3 py-2.5 text-sm" aria-label="New owner">
                  {team.filter((s) => s.role !== "admin").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="rounded-xl bg-ink px-4 text-sm font-semibold text-white">Move</button>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
