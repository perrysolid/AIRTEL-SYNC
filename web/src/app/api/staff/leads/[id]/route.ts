import { z } from "zod";
import { activityFor, CALL_OUTCOMES, canSee, leadPhone, leadViews, listStaff, logActivity, outreachFor, STATUSES, type LeadStatus } from "@/lib/crm";
import { leadRow, staffOr401 } from "@/lib/staff-api";
import { chatSummary } from "@/lib/chat-summary";
import { store } from "@/lib/store";
import { product } from "@/lib/catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(id: string, roles?: Parameters<typeof staffOr401>[0]) {
  const a = await staffOr401(roles);
  if ("res" in a) return a;
  const lead = (await leadViews()).get(id);
  if (!lead || !canSee(a.staff, lead)) return { res: Response.json({ error: "This lead isn't in your book." }, { status: 404 }) };
  return { staff: a.staff, lead };
}

/** One lead: profile, why the score says what it says, every touch so far, and the win-back message to send. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const l = await load((await params).id);
  if ("res" in l) return l.res;
  const staff = await listStaff();
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const r = l.lead.row;
  return Response.json({
    ...leadRow(l.lead, names),
    phone: leadPhone(l.lead),
    contact: r.contact_name,
    contactRole: r.contact_role,
    employees: Number(r.employee_count),
    sites: Number(r.num_sites),
    turnover: r.annual_turnover_band,
    gstin: r.has_gstin === "Y",
    udyam: r.has_udyam === "Y",
    internetToday: r.current_internet,
    providerToday: r.current_provider,
    spendToday: Number(r.monthly_telecom_spend_inr || 0),
    interests: r.products_of_interest.split(";").filter(Boolean).map((id) => { try { return product(id).name; } catch { return id; } }),
    chats: await Promise.all(
      l.lead.sessionIds.map((id) => store.getSession(id)).filter((s) => !!s).sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt)).slice(0, 3).map(async (s) => ({ id: s.id, at: s.updatedAt, channel: s.channel, summary: await chatSummary(s) })),
    ),
    activity: (await activityFor(l.lead.id)).map((x) => ({ ...x, staffName: names.get(x.staffId) ?? x.staffId })),
    outreach: outreachFor(r),
    assignable: l.staff.role === "admin" || l.staff.role === "supervisor" ? staff.filter((s) => s.role !== "admin").map((s) => ({ id: s.id, name: s.name, role: s.role, region: s.region })) : [],
  });
}

const Touch = z.object({
  kind: z.enum(["call", "whatsapp", "note"]),
  outcome: z.enum(CALL_OUTCOMES).optional(),
  status: z.enum(Object.keys(STATUSES) as [LeadStatus, ...LeadStatus[]]).optional(),
  note: z.string().max(1000).default(""),
  nextAt: z.string().optional(),
});

/** Log a call, a WhatsApp sent, or a note, with an optional new status and follow-up time. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // The manager reads; the area salesman and the supervisor do the calling.
  const l = await load((await params).id, ["sales", "supervisor"]);
  if ("res" in l) return l.res;
  const t = Touch.safeParse(await req.json().catch(() => ({})));
  if (!t.success) return Response.json({ error: "Check the form." }, { status: 400 });
  if (t.data.kind === "call" && !t.data.outcome) return Response.json({ error: "Pick how the call went." }, { status: 400 });
  const { kind, outcome, note } = t.data;
  const status = t.data.status ?? (outcome === "Not interested" ? "lost" : outcome === "Wrong number" ? "dnc" : l.lead.status === "to_call" && kind !== "note" ? "contacted" : undefined);
  const nextAt = t.data.nextAt ? new Date(t.data.nextAt).toISOString() : undefined;
  const act = await logActivity({ leadId: l.lead.id, staffId: l.staff.id, kind, outcome, status, note: note.trim(), nextAt });
  return Response.json({ ok: true, activity: act });
}
