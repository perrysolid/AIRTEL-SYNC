"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { authenticate } from "@/lib/staff-login";
import { CALL_OUTCOMES, canSee, leadViews, logActivity, staffById, STATUSES, type LeadStatus } from "@/lib/crm";
import { requireStaff } from "@/lib/staff-session";

export async function signIn(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const r = await authenticate(String(form.get("email") ?? ""), String(form.get("password") ?? ""), ip);
  if ("error" in r) return { error: r.error };
  (await cookies()).set(SESSION_COOKIE, r.token, cookieOptions());
  redirect("/sales");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sales/login");
}

const Touch = z.object({
  leadId: z.string().regex(/^L\d{5}$/),
  kind: z.enum(["call", "whatsapp", "note"]),
  outcome: z.enum(CALL_OUTCOMES).optional(),
  status: z.enum(Object.keys(STATUSES) as [LeadStatus, ...LeadStatus[]]).optional(),
  note: z.string().max(1000).default(""),
  nextAt: z.string().optional(),
});

/** Logs a call, a WhatsApp link sent or a note, with an optional new status and follow-up. */
export async function logTouch(_prev: { ok?: boolean; error?: string } | undefined, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const staff = await requireStaff();
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)]));
  const parsed = Touch.safeParse(raw);
  if (!parsed.success) return { error: "Check the form: pick an outcome for calls." };
  const t = parsed.data;
  if (t.kind === "call" && !t.outcome) return { error: "Pick how the call went." };
  const lead = (await leadViews()).get(t.leadId);
  if (!lead || !canSee(staff, lead)) return { error: "This lead isn't in your book." };
  const status = t.status ?? (t.outcome === "Not interested" ? "lost" : t.outcome === "Wrong number" ? "dnc" : lead.status === "to_call" && t.kind !== "note" ? "contacted" : undefined);
  const nextAt = t.nextAt ? new Date(t.nextAt).toISOString() : undefined;
  await logActivity({ leadId: t.leadId, staffId: staff.id, kind: t.kind, outcome: t.outcome, status, note: t.note.trim(), nextAt });
  revalidatePath(`/sales/leads/${t.leadId}`);
  return { ok: true };
}

/** Managers move a lead to another salesperson or partner. */
export async function reassign(form: FormData) {
  const staff = await requireStaff(["admin", "supervisor"]);
  const leadId = String(form.get("leadId"));
  const to = await staffById(String(form.get("to")));
  if (!to || to.role === "admin" || !(await leadViews()).has(leadId)) return;
  await logActivity({ leadId, staffId: staff.id, kind: "assign", note: to.id });
  revalidatePath(`/sales/leads/${leadId}`);
}
