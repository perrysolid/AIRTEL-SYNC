import { product } from "./catalogue";

/**
 * Staged activation. Instead of one 10-14 day wait, the order is split into
 * independent tracks so mobile lines and cloud apps go live on day 0-1 while
 * fibre is still being installed. Each step change pushes a WhatsApp update,
 * so the owner never has to call to chase status.
 */

export interface TrackStep {
  key: string;
  label: string;
  dueDay: number;
  doneAtDay?: number;
  /** What the owner is told when this step completes; the label is used when there is none. */
  note?: string;
}

export interface Track {
  key: "mobile" | "internet" | "devices" | "comms";
  title: string;
  productIds: string[];
  steps: TrackStep[];
}

export interface OrderTimeline {
  /** Demo clock: days since the agreement was signed (activation starts then; the first bill comes when all is live). -1 = not started. */
  clockDay: number;
  tracks: Track[];
  events: { day: number; text: string }[];
}

const TRACK_OF: Record<string, Track["key"]> = {
  P07: "mobile", P08: "mobile", P16: "mobile", P17: "mobile", P18: "mobile", P20: "mobile",
  P01: "internet", P02: "internet", P03: "internet", P04: "internet", P05: "internet", P06: "internet",
  P09: "internet", P10: "internet", P11: "internet", P21: "internet", P22: "internet",
  P19: "devices", P23: "devices", P24: "devices", P25: "devices",
  P12: "comms", P13: "comms", P14: "comms", P15: "comms",
};

const TITLES: Record<Track["key"], string> = {
  mobile: "Mobile lines & cloud apps",
  internet: "Internet",
  devices: "Devices & cameras",
  comms: "Customer messaging & calling",
};

// Field technicians for the demo, picked per order so the same order always shows the same person.
const TECHNICIANS = [
  { name: "Ravi Kumar", phone: "98•••• 4312" },
  { name: "Imran Shaikh", phone: "97•••• 8820" },
  { name: "Suresh Yadav", phone: "99•••• 1047" },
  { name: "Manoj Patil", phone: "90•••• 6635" },
  { name: "Arun Nair", phone: "94•••• 2290" },
];
const pick = <T,>(xs: T[], seed: string) => xs[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % xs.length];
const speedOf = (ids: string[]) => {
  const mbps = Math.max(...ids.map((id) => Number(product(id).name.match(/(\d+)\s*(G)?\b/)?.[1] ?? 0) * (/\dG\b/.test(product(id).name) ? 1000 : 1)));
  return mbps ? Math.round(mbps * 0.96) : undefined;
};

export function buildTimeline(productIds: string[], seed = productIds.join("")): OrderTimeline {
  const groups = new Map<Track["key"], string[]>();
  for (const id of productIds) {
    const k = TRACK_OF[id] ?? "devices";
    groups.set(k, [...(groups.get(k) ?? []), id]);
  }
  const maxDays = (ids: string[]) => Math.max(...ids.map((id) => product(id).installDays));
  const tech = pick(TECHNICIANS, seed);
  const tracks: Track[] = [];
  for (const key of ["mobile", "internet", "comms", "devices"] as Track["key"][]) {
    const ids = groups.get(key);
    if (!ids) continue;
    const d = maxDays(ids);
    const speed = speedOf(ids);
    const steps: TrackStep[] =
      key === "mobile"
        ? [
            { key: "provisioned", label: "Numbers and accounts created", dueDay: 0, note: "📱 Your business numbers are reserved and your cloud app logins are created." },
            { key: "delivery", label: "SIMs out for delivery", dueDay: Math.min(d, 1), note: "🛵 Your SIMs are out for delivery today. Keep any photo ID handy for a one-minute check at the door." },
            { key: "live", label: "SIMs live, app logins sent", dueDay: Math.min(d, 1), note: "✅ SIMs are live and your app logins are on your email. Calls and data work now." },
          ]
        : key === "internet"
          ? ids.some((id) => ["P01", "P02", "P03"].includes(id))
            ? [
                { key: "feasibility", label: "Fibre confirmed at your address", dueDay: 1, note: "📍 Survey done: fibre reaches your street, so we can install a wired line." },
                { key: "assigned", label: `Technician assigned: ${tech.name}`, dueDay: 1, note: `👷 ${tech.name} (${tech.phone}) is your installation technician. They'll call 30 minutes before arriving.` },
                { key: "scheduled", label: "Technician visit booked", dueDay: 1, note: "📅 Installation visit booked. Pick a different time in your tracker if it doesn't suit you." },
                { key: "onway", label: "Technician on the way", dueDay: Math.max(2, d - 1), note: `🚐 ${tech.name} is on the way and should reach you in about 30 minutes.` },
                { key: "installed", label: "Fibre installed and tested", dueDay: Math.max(2, d - 1), note: `🔧 Fibre installed and tested at your counter${speed ? `: ${speed} Mbps` : ""}. The Wi-Fi name and password are on the router sticker.` },
                { key: "live", label: "Internet live", dueDay: d, note: "🌐 Your internet is live. UPI, billing and cameras can use it from now." },
              ]
            : [
                { key: "dispatched", label: "Router dispatched", dueDay: 0, note: "📦 Your 5G AirFiber router is packed and on its way." },
                { key: "installed", label: "Installed and tested", dueDay: Math.max(1, d - 1), note: `🔧 AirFiber set up and tested${speed ? `: ${speed} Mbps` : ""}. The Wi-Fi name and password are on the router sticker.` },
                { key: "live", label: "Internet live", dueDay: d, note: "🌐 Your internet is live." },
              ]
          : key === "comms"
            ? [
                { key: "submitted", label: "Sender ID / WhatsApp verification filed", dueDay: 0, note: "📝 We've filed your business name for SMS sender ID and WhatsApp verification. Nothing for you to do." },
                { key: "approved", label: "Approved by operator / Meta", dueDay: Math.max(1, d - 1), note: "✅ Approved: your business name is verified for SMS and WhatsApp." },
                { key: "live", label: "Ready to message customers", dueDay: d, note: "💬 You can now send offers and order updates to your customers." },
              ]
            : [
                { key: "dispatched", label: "Devices dispatched", dueDay: 1, note: "📦 Your devices are dispatched." },
                { key: "installed", label: "Installed and app connected", dueDay: d, note: "🧰 Devices installed and set up. Your team can start using them today." },
              ];
    tracks.push({ key, title: TITLES[key], productIds: ids, steps });
  }
  return { clockDay: -1, tracks, events: [] };
}

/** Installation starts when the agreement is signed; payment comes after everything is live. */
export const activationStarted = (t: OrderTimeline) => t.clockDay >= 0;
export const allLive = (t: OrderTimeline) => t.clockDay >= 0 && t.clockDay >= liveDay(t);

export function stepStatus(step: TrackStep, clockDay: number): "done" | "active" | "upcoming" {
  if (step.doneAtDay !== undefined || (clockDay >= 0 && step.dueDay <= clockDay)) return "done";
  if (clockDay >= 0 && step.dueDay === clockDay + 1) return "active";
  return "upcoming";
}

export function liveDay(t: OrderTimeline): number {
  return Math.max(0, ...t.tracks.flatMap((tr) => tr.steps.map((s) => s.dueDay)));
}

/**
 * Advances the demo clock by `days` and returns the owner notifications that
 * the newly completed steps produce.
 */
export function advance(t: OrderTimeline, days: number): string[] {
  const from = t.clockDay;
  t.clockDay = Math.min(from + days, liveDay(t));
  const msgs: string[] = [];
  for (const tr of t.tracks) {
    for (const s of tr.steps) {
      if (s.dueDay > from && s.dueDay <= t.clockDay) {
        s.doneAtDay = s.dueDay;
        msgs.push(s.note ?? `✅ ${tr.title}: ${s.label}.`);
      }
    }
  }
  if (t.clockDay === liveDay(t) && from < t.clockDay) msgs.push("🎉 Everything is live. One bill, one support number: 121, or reply HELP here.");
  for (const m of msgs) t.events.push({ day: t.clockDay, text: m });
  return msgs;
}

/**
 * Fibre not feasible at the site: swap fibre for 5G AirFiber (2-day install)
 * instead of letting the order stall past 21 days — the #1 post-KYC drop reason.
 */
export function fallbackToAirFiber(t: OrderTimeline): string | undefined {
  const tr = t.tracks.find((x) => x.key === "internet");
  if (!tr) return;
  const fibre = tr.productIds.find((id) => ["P01", "P02", "P03"].includes(id));
  if (!fibre) return;
  tr.productIds = tr.productIds.map((id) => (id === fibre ? "P04" : id)).filter((id) => id !== "P11");
  const start = Math.max(0, t.clockDay);
  tr.steps = [
    { key: "feasibility", label: "Fibre not feasible — switched to 5G AirFiber at no extra cost", dueDay: start, doneAtDay: start },
    { key: "dispatched", label: "AirFiber router dispatched", dueDay: start + 1 },
    { key: "live", label: "Internet live", dueDay: start + 2 },
  ];
  const msg = `📡 Fibre isn't available at your address yet, so we've switched you to 5G AirFiber (${product("P04").name}). No cabling, live in 2 days, and your bill goes down. Reply FIBRE to be moved to fibre when it arrives.`;
  t.events.push({ day: start, text: msg });
  return msg;
}
