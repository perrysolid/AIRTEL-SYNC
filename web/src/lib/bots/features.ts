import { addFailover, checkSpeed, createTicket, hasFailover } from "../continuity";
import { createBranch, previewBranch } from "../branch";
import { checkNetwork } from "../network";
import { applyNetworkToSession } from "../network-session";
import { inr } from "../format";
import { scheduleInstall, slotsFor } from "../scheduler";
import { analyzeScam, looksForwarded, scamChatText } from "../scam";
import { tierForCity } from "../profile";
import { store, type BotFlow, type Order } from "../store";
import { contactKey, currentSession as currentSessionFor, latestOrder } from "./lookup";
import { publicUrl, type BotMessage } from "./types";
import type { BotInput } from "./core";

/**
 * Chat features that sit beside the advisor: Scam Shield, Network Reality Check, install scheduler,
 * troubleshooter, backup link and Branch-in-a-Box. One implementation serves WhatsApp, Telegram and the simulator.
 * Multi-step flows keep a small BotFlow per chat; "1", "2"... or a tapped option both work.
 */

const msg = (text: string, options?: { label: string; value: string }[]): BotMessage => ({ text, options });
const FLOW_PREFIX = "f:";
const CITIES = ["Pune", "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Lucknow", "Nashik", "Nagpur", "Indore", "Surat", "Patna", "Bhopal", "Coimbatore", "Ludhiana", "Mysuru", "Vadodara", "Visakhapatnam"];

export const FEATURE_HELP = "**SHIELD** — check a suspicious message\n**NETWORK 411016** — is my area covered?\n**SCHEDULE** — book or change my install slot\n**TROUBLE** — slow or no internet\n**BRANCH** — open a new location\n**BACKUP** — add a backup internet link";

function orderFor(input: BotInput): Order | undefined {
  return latestOrder(input.chat, input.phone ?? (input.chat.channel === "whatsapp" ? input.chat.chatId : undefined));
}

const noOrder = msg("I couldn't find an order for this chat yet. Tell me about your business and I'll build your plan first.");

export async function featureTurn(input: BotInput, raw: string, cmd: string): Promise<BotMessage[] | undefined> {
  const key = contactKey(input.chat);
  const flow = store.getFlow(key);
  const lang = /[ऀ-ॿ]/.test(raw) ? "hi" : "en";
  const lower = raw.toLowerCase().trim();

  // Leaving a flow
  if (["menu", "help", "new", "restart", "start", "cancel"].includes(cmd) && flow) store.clearFlow(key);

  // ---- commands that start a feature
  if (["shield", "scam", "check"].includes(cmd) && raw.trim().split(/\s+/).length <= 1) {
    store.saveFlow(key, { kind: "shield" });
    return [msg("🛡️ **SYNC Scam Shield**\nForward me any suspicious message, link or payment details and I'll tell you what looks wrong and what to do. Reply MENU to stop.")];
  }
  if (cmd === "network") return networkTurn(key, input, raw.replace(/^\/?network\s*/i, ""));
  if (["schedule", "reschedule"].includes(cmd)) return scheduleStart(key, input);
  if (["trouble", "fix", "problem"].includes(cmd)) return troubleStart(key, input);
  if (cmd === "branch") return branchTurn(key, input, "", { kind: "branch" });
  if (cmd === "backup") {
    const o = orderFor(input);
    if (!o) return [noOrder];
    const r = addFailover(o);
    store.saveOrder(o);
    return [msg(r.ok ? (r.added ? `✅ Backup 4G/5G Failover added. Your new total is **${inr(o.quote.monthlyWithGst)}/month** incl. GST.` : "You already have Backup 4G/5G Failover. 👍") : r.error)];
  }

  // ---- continue a flow
  if (flow) {
    const picked = flow.opts && /^\d+$/.test(lower) ? flow.opts[Number(lower) - 1] : raw.startsWith(FLOW_PREFIX) ? raw.slice(FLOW_PREFIX.length) : undefined;
    switch (flow.kind) {
      case "shield":
        return [msg(scamChatText(analyzeScam(raw, lang)) + "\n\nSend another to check, or reply MENU.")];
      case "network":
        return networkTurn(key, input, raw);
      case "schedule":
        return scheduleTurn(key, input, flow, picked);
      case "trouble":
        return troubleTurn(key, input, flow, picked ?? raw);
      case "branch":
        return branchTurn(key, input, raw, flow);
    }
  }

  // ---- unprompted forward: a link or obvious scam wording
  if (!/^(type|city|emp|sites|gst|needs|c|a):/.test(raw) && raw.length > 12 && looksForwarded(raw)) {
    return [msg("🛡️ That looks like it could be a scam message. Here's what I found:"), msg(scamChatText(analyzeScam(raw, lang)))];
  }
  return undefined;
}

// ------------------------------------------------------------------ network
function networkTurn(key: string, input: BotInput, text: string): BotMessage[] {
  const pin = text.match(/\b[1-9]\d{5}\b/)?.[0];
  if (!pin) {
    store.saveFlow(key, { kind: "network" });
    return [msg("Send the 6-digit pincode of your shop, e.g. **NETWORK 411016**. I'll tell you what can be installed there before you pay anything.")];
  }
  const s = currentSessionFor(input.chat);
  const city = CITIES.find((c) => text.toLowerCase().includes(c.toLowerCase())) ?? s?.profile.city ?? orderFor(input)?.city;
  const r = checkNetwork(pin, city);
  if (!r.ok) return [msg(r.error)];
  let note = "";
  if (s?.recommendation && applyNetworkToSession(s, r)) {
    store.saveSession(s);
    note = `\n\nI've updated your quote: **${inr(s.quote!.monthlyWithGst)}/month** incl. GST.`;
  }
  store.clearFlow(key);
  const lines = r.options.slice(0, 2).map((o) => `${o.available ? "✅" : "❌"} ${o.name} — ${o.available ? `~${o.installDays} days` : "not available"}`);
  return [msg(`📡 **Network Reality Check** — ${pin}${city ? ` (${city})` : ""}\n${lines.join("\n")}\n\n${r.message}${note}\n\n_Coverage is simulated in this demo._`)];
}

// ----------------------------------------------------------------- scheduler
function scheduleStart(key: string, input: BotInput): BotMessage[] {
  const o = orderFor(input);
  if (!o) return [noOrder];
  if (o.timeline.clockDay < 0) return [msg("Once your order is paid and activation starts, I can offer installation slots. Reply STATUS to see what's next.")];
  const slots = slotsFor(o, 6);
  if (!slots.length) return [msg("Your order has no technician visit to schedule: SIMs and cloud apps are activated remotely. 👍")];
  store.saveFlow(key, { kind: "schedule", orderId: o.id, opts: slots.map((s) => s.id) });
  return [msg(`${o.slot ? `Your slot is **${o.slot.label}**. Pick a new one:` : "Pick an installation slot:"}`, slots.map((s) => ({ label: s.label, value: FLOW_PREFIX + s.id })))];
}

function scheduleTurn(key: string, input: BotInput, flow: BotFlow, picked?: string): BotMessage[] {
  const o = flow.orderId ? store.getOrder(flow.orderId) : orderFor(input);
  if (!o) return [noOrder];
  if (!picked) return scheduleStart(key, input);
  const r = scheduleInstall(o, picked);
  store.clearFlow(key);
  if (!r.ok) return [msg(r.error)];
  store.saveOrder(o);
  return [msg(`📅 Booked: **${r.slot.label}**. A technician will arrive in that window, and you'll get a reminder the evening before. Need to change it? Reply RESCHEDULE.`, [{ label: "Track my order", value: "status" }])];
}

// ------------------------------------------------------------- troubleshooter
const TROUBLE_OPTS = [
  { label: "Internet is slow", value: "slow" },
  { label: "No internet", value: "down" },
  { label: "Billing question", value: "billing" },
  { label: "Something else", value: "other" },
];

function troubleStart(key: string, input: BotInput): BotMessage[] {
  const o = orderFor(input);
  if (!o) return [noOrder];
  store.saveFlow(key, { kind: "trouble", orderId: o.id, opts: TROUBLE_OPTS.map((x) => x.value), step: "pick" });
  const known = o.outageActive ? "\n⚠️ We already see an outage on your link; a ticket and ETA are on the way." : "";
  return [msg("What's wrong?" + known, TROUBLE_OPTS.map((x) => ({ label: x.label, value: FLOW_PREFIX + x.value })))];
}

function troubleTurn(key: string, input: BotInput, flow: BotFlow, answer: string): BotMessage[] {
  const o = flow.orderId ? store.getOrder(flow.orderId) : orderFor(input);
  if (!o) return [noOrder];
  const done = (m: BotMessage[]) => {
    store.clearFlow(key);
    store.saveOrder(o);
    return m;
  };
  const a = answer.toLowerCase().trim();
  if (flow.step === "pick") {
    const pick = a === "slow" || /slow|speed|buffer/.test(a) ? "slow" : a === "down" || /down|no internet|not working|offline|disconnect/.test(a) ? "down" : a === "billing" || /bill|invoice|charge/.test(a) ? "billing" : "other";
    if (pick === "slow") {
      store.saveFlow(key, { ...flow, step: "slow" });
      return [msg("Let's check it. Run a speed test (fast.com or TRAI's MySpeed app) and send me the number in Mbps. Reply SKIP if you can't.")];
    }
    if (pick === "down") {
      if (o.outageActive) {
        const inc = o.incidents?.[0];
        return done([msg(hasFailover(o) ? "You're still online on the backup link while we fix the main line. I'll message you when it's back." : `We already know: your link is down. Ticket ${inc?.ticketId ?? ""} is open and a technician is on it (fix within 4 hours). I'll message you the moment it's back.`)]);
      }
      store.saveFlow(key, { ...flow, step: "down" });
      return [msg("Quick checks:\n1) Is the router's power light on?\n2) Unplug it for 30 seconds, plug back in, wait 2 minutes.\n3) Check the cable at the wall is firm.\n\nDid that fix it?", [{ label: "Yes, fixed", value: "yes" }, { label: "No, still down", value: "no" }])];
    }
    if (pick === "billing") {
      store.saveFlow(key, { ...flow, step: "billing" });
      return [msg(`Your bill is **${inr(o.quote.monthlyWithGst)}/month** incl. GST on one invoice for all products. Want a billing expert to review a charge?`, [{ label: "Yes, raise a ticket", value: "yes" }, { label: "No, that's fine", value: "no" }])];
    }
    store.saveFlow(key, { ...flow, step: "other" });
    return [msg("Tell me what's happening in a sentence and I'll route it to the right technician.")];
  }
  if (flow.step === "slow") {
    const n = a.match(/\d+(\.\d+)?/);
    if (a === "skip" || !n) return done([msg("No problem. Connect closer to the router, restart it and pause big downloads. Reply TROUBLE if it continues.")]);
    const r = checkSpeed(o, Number(n[0]));
    if (!r.plan) return done([msg("Your plan isn't a fixed-speed plan, so I can't compare. Reply TROUBLE to raise a ticket.")]);
    const pct = Math.round((100 * r.measured) / r.plan);
    return done([msg(r.ok ? `You're getting ${r.measured} Mbps, ${pct}% of your ${r.plan} Mbps plan. That's normal (we treat below 80% as a fault).` : `⚠️ ${r.measured} Mbps is only ${pct}% of your ${r.plan} Mbps plan. I've raised ticket **${r.ticket!.id}** with your test attached; ${r.ticket!.assignedTo} will fix it within ${r.ticket!.slaHours} hours.`)]);
  }
  if (flow.step === "down") {
    if (["yes", "1", "fixed"].includes(a)) return done([msg("Glad it's back! 🎉")]);
    const t = createTicket(o, "no_internet", "Customer reports no internet; restart did not help.", ["Power-cycled router", "Checked cable"]);
    return done([msg(`Sorry about that. I've raised ticket **${t.id}** with the steps you tried, so you won't repeat yourself. ${t.assignedTo} will fix it within ${t.slaHours} hours, and I'll update you here.`)]);
  }
  if (flow.step === "billing") {
    if (["yes", "1"].includes(a)) {
      const t = createTicket(o, "billing", "Customer asked for a billing review.");
      return done([msg(`Done: ticket **${t.id}** raised. A billing expert will reply within ${t.slaHours} hours.`)]);
    }
    return done([msg("Okay. Reply TROUBLE anytime.")]);
  }
  const t = createTicket(o, "other", answer.slice(0, 400));
  return done([msg(`Thanks. I've raised ticket **${t.id}** and routed it to ${t.assignedTo} (SLA ${t.slaHours}h).`)]);
}

// ------------------------------------------------------------ Branch-in-a-Box
function branchTurn(key: string, input: BotInput, text: string, flow: BotFlow): BotMessage[] {
  const o = orderFor(input);
  if (!o) return [noOrder];
  if (flow.step === "confirm" && flow.data && ["yes", "y", "confirm", "haan", "ok"].includes(text.toLowerCase().trim())) {
    const r = createBranch(o, { name: flow.data.name, city: flow.data.city, pincode: flow.data.pincode });
    store.clearFlow(key);
    if (!r.ok) return [msg(r.error)];
    return [{ text: `🏪 Branch created: order **${r.order.id}** for ${flow.data.name}.\nKYC reused. Now send the new branch's **address proof** (≤ 90 days old) on the secure page, and reply SCHEDULE to book the install.`, buttons: [{ label: "Open the branch order", url: publicUrl(`/order/${r.order.id}`) }] }];
  }
  const pin = text.match(/\b[1-9]\d{5}\b/)?.[0];
  const city = CITIES.find((c) => text.toLowerCase().includes(c.toLowerCase()));
  if (!pin || !city || !tierForCity(city)) {
    store.saveFlow(key, { kind: "branch", step: "ask" });
    return [msg("Where is the new branch? Send the city and 6-digit pincode, e.g. **Nashik 422001**.")];
  }
  const name = `${city} branch`;
  const pv = previewBranch(o, { name, city, pincode: pin });
  if (!pv.ok) return [msg(pv.error)];
  store.saveFlow(key, { kind: "branch", step: "confirm", data: { name, city, pincode: pin } });
  const p = pv.preview;
  const lines = p.quote.lines.filter((l) => l.active).map((l) => `• ${l.name} ×${l.qty}`);
  const extra = p.network.fallbackApplied ? `\n⚠️ ${p.network.message}${p.removed.length ? ` Not copied (needs a fixed line): ${p.removed.join(", ")}.` : ""}` : `\n${p.network.message}`;
  return [msg(`🏪 **Branch-in-a-Box** for ${city} (${pin}), copied from your head office:\n${lines.join("\n")}\n\n+${inr(p.quote.monthlyWithGst)}/month incl. GST (total after: ${inr(p.totalAfter)}).${extra}\n✅ KYC reused; only the new address proof is needed.\n\nReply **YES** to create it.`, [{ label: "Yes, create it", value: "yes" }])];
}
