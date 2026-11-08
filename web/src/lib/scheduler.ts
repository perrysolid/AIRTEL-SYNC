import { notifyOrder } from "./notify";
import type { Order } from "./store";

/**
 * Installation scheduler: the owner picks a visit window instead of phoning to fix a date.
 * Slots are expressed on the order's demo clock (`day`), and the internet track's install step is moved to match.
 */

export const WINDOWS = ["9 am – 12 pm", "12 pm – 3 pm", "3 pm – 6 pm"] as const;
export const MAX_RESCHEDULES = 2;

export interface Slot {
  id: string;
  day: number;
  date: string; // YYYY-MM-DD
  window: string;
  label: string;
}

const baseDate = (o: Order) => new Date(o.esign?.at ?? o.createdAt);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

function internetTrack(o: Order) {
  return o.timeline.tracks.find((t) => t.key === "internet");
}

/** Days on the demo clock on which a technician visit could happen: after today, before the original install day. */
export function slotsFor(o: Order, limit = 12): Slot[] {
  const tr = internetTrack(o);
  const installed = tr?.steps.find((s) => s.key === "installed");
  if (!tr || !installed) return [];
  const earliest = Math.max(1, o.timeline.clockDay + 1, installed.dueDay - 1);
  const out: Slot[] = [];
  for (let day = earliest; day < earliest + 7 && out.length < limit; day++) {
    const date = addDays(baseDate(o), day);
    if (date.getUTCDay() === 0) continue; // no Sunday installs
    for (const w of WINDOWS) out.push({ id: `${iso(date)}|${w}`, day, date: iso(date), window: w, label: `${fmt(date)} · ${w}` });
  }
  return out.slice(0, limit);
}

export type ScheduleResult = { ok: true; slot: NonNullable<Order["slot"]> } | { ok: false; error: string };

export function scheduleInstall(o: Order, slotId: string): ScheduleResult {
  const tr = internetTrack(o);
  if (!tr) return { ok: false, error: "This order has no installation to schedule." };
  const s = slotsFor(o, 40).find((x) => x.id === slotId);
  if (!s) return { ok: false, error: "That slot is no longer available. Please pick another." };
  if (o.slot && (o.reschedules ?? 0) >= MAX_RESCHEDULES) return { ok: false, error: "You've used both free reschedules. A partner will call to help." };
  if (o.slot) o.reschedules = (o.reschedules ?? 0) + 1;
  o.slot = { id: s.id, label: s.label, date: s.date, window: s.window, day: s.day };

  const installed = tr.steps.find((x) => x.key === "installed");
  const live = tr.steps.find((x) => x.key === "live");
  const scheduled = tr.steps.find((x) => x.key === "scheduled");
  if (installed) installed.dueDay = s.day;
  if (live) live.dueDay = Math.max(s.day, live.dueDay >= s.day ? s.day + 1 : s.day + 1);
  if (scheduled) scheduled.label = `Technician visit booked for ${s.label}`;
  notifyOrder(o, `📅 Installation booked: ${s.label}. Need to change it? Reply RESCHEDULE.`);
  return { ok: true, slot: o.slot };
}
