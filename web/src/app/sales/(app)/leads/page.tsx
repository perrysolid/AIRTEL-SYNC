import Link from "next/link";
import { Search } from "lucide-react";
import { listStaff, STATUSES, visibleLeads, type LeadStatus } from "@/lib/crm";
import { requireStaff } from "@/lib/staff-session";
import { PageHead, ScoreBadge, StatusBadge, when } from "../ui";

const PAGE = 50;
const SORTS = { score: "Chance to activate", recent: "Newest lead", followup: "Next follow-up" } as const;

export default async function Leads({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const status = sp.status as LeadStatus | undefined;
  const band = sp.band;
  const source = sp.source;
  const owner = sp.owner;
  const sort = (sp.sort as keyof typeof SORTS) ?? "score";
  const page = Math.max(1, Number(sp.page) || 1);
  const team = await listStaff();
  const names = new Map(team.map((s) => [s.id, s.name.split(" (")[0]]));

  const all = await visibleLeads(staff);
  const sources = [...new Set(all.map((l) => l.row.lead_source))].sort();
  let rows = all.filter(
    (l) =>
      (!q || `${l.id} ${l.row.business_name} ${l.row.city} ${l.row.contact_name} ${l.row.business_type}`.toLowerCase().includes(q)) &&
      (!status || l.status === status) &&
      (!band || l.score.band === band) &&
      (!source || l.row.lead_source === source) &&
      (!owner || l.owner === owner),
  );
  rows = rows.sort((a, b) =>
    sort === "recent" ? b.row.created_date.localeCompare(a.row.created_date) : sort === "followup" ? (a.nextAt ?? "9").localeCompare(b.nextAt ?? "9") : b.score.probability - a.score.probability,
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const link = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]);
    return `/sales/leads?${u}`;
  };
  const select = "rounded-xl border border-rule bg-sheet px-3 py-2.5 text-sm";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="Lead records" sub={`${rows.length.toLocaleString("en-IN")} of ${all.length.toLocaleString("en-IN")} leads in ${staff.role === "admin" ? "the team's books" : "your book"}`} />

      <form className="mt-6 flex flex-wrap gap-2" action="/sales/leads">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search</span>
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft" />
          <input name="q" defaultValue={sp.q} placeholder="Business, city, contact or lead ID" className="w-full rounded-xl border border-rule bg-sheet py-2.5 pr-3 pl-9 text-sm" />
        </label>
        <select name="status" defaultValue={status ?? ""} className={select} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="band" defaultValue={band ?? ""} className={select} aria-label="Score band">
          <option value="">Any score</option>
          <option value="hot">Hot (15%+)</option>
          <option value="warm">Warm (7–15%)</option>
          <option value="cold">Cold</option>
        </select>
        <select name="source" defaultValue={source ?? ""} className={select} aria-label="Lead source">
          <option value="">Any source</option>
          {sources.map((s) => <option key={s}>{s}</option>)}
        </select>
        {staff.role === "admin" && (
          <select name="owner" defaultValue={owner ?? ""} className={select} aria-label="Owner">
            <option value="">Anyone</option>
            {team.filter((s) => s.role !== "admin").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select name="sort" defaultValue={sort} className={select} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Sort: {v}</option>)}
        </select>
        <button className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white">Apply</button>
      </form>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-rule text-ink-soft">
            <tr>
              <th className="px-5 py-3 font-medium">Business</th>
              <th className="px-3 py-3 font-medium">Chance</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">Last touch</th>
              {staff.role === "admin" && <th className="px-3 py-3 font-medium">Owner</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {shown.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-paper">
                <td className="px-5 py-3">
                  <Link href={`/sales/leads/${l.id}`} className="font-semibold hover:underline">{l.row.business_name}</Link>
                  <div className="text-ink-soft">{l.row.business_type}, {l.row.city} <span className="font-mono text-xs">{l.id}</span></div>
                </td>
                <td className="px-3 py-3"><ScoreBadge p={l.score.probability} band={l.score.band} /></td>
                <td className="px-3 py-3">
                  <StatusBadge s={l.status} />
                  {l.nextAt && <div className={`mt-1 text-xs ${new Date(l.nextAt).getTime() < Date.now() ? "font-semibold text-bad" : "text-ink-soft"}`}>Follow up {when(l.nextAt)}</div>}
                </td>
                <td className="px-3 py-3 text-ink-soft">{l.row.lead_source}</td>
                <td className="px-3 py-3 text-ink-soft">{l.lastTouch ? `${l.lastTouch.outcome ?? l.lastTouch.kind}, ${when(l.lastTouch.at)}` : "Never"}</td>
                {staff.role === "admin" && <td className="px-3 py-3 text-ink-soft">{names.get(l.owner)}</td>}
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-soft">No leads match these filters. Clear a filter to see more.</td></tr>}
          </tbody>
        </table>
      </div>

      <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
        <span className="text-ink-soft">Page {page} of {pages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={link({ page: page - 1 })} className="rounded-lg border border-rule bg-sheet px-3 py-1.5 font-semibold">Previous</Link>}
          {page < pages && <Link href={link({ page: page + 1 })} className="rounded-lg border border-rule bg-sheet px-3 py-1.5 font-semibold">Next</Link>}
        </div>
      </nav>
    </div>
  );
}
