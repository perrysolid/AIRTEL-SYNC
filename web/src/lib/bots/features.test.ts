import { beforeAll, describe, expect, it } from "vitest";
import { botTurn } from "./core";
import { store, type BotChat, type Order } from "../store";
import { advance } from "../tracker";

beforeAll(() => {
  process.env.AI_DISABLED = "1";
});

const RUN = Date.now().toString(36);
const chatOf = (k: string): BotChat => ({ channel: "telegram", chatId: `${k}-${RUN}` });
const say = async (c: BotChat, text: string) => botTurn({ chat: c, text, firstName: "Asha" });
const all = (ms: { text: string }[]) => ms.map((m) => m.text).join("\n");

/** A chat with a paid, activating order for a dental clinic (fibre, so backup is possible). */
async function paidOrder(k: string): Promise<{ c: BotChat; order: Order }> {
  const c = chatOf(k);
  await say(c, "/start");
  for (const t of ["c:type:Dental clinic", "c:city:Kochi", "c:emp:15", "c:gst:no", "c:cur:Home broadband", "needs:email"]) await say(c, t);
  await botTurn({ chat: c, text: "a:order", firstName: "Asha", phone: "+91 98111 22233" });
  const order = store.listOrders().find((o) => o.botChat?.chatId === c.chatId)!;
  order.timeline.clockDay = 0;
  advance(order.timeline, 0);
  order.payment = { at: new Date().toISOString(), method: "upi_autopay", amount: order.quote.monthlyWithGst, ref: "UPI-T" };
  store.saveOrder(order);
  return { c, order };
}

describe("chat features: Scam Shield", () => {
  it("SHIELD starts a flow, judges forwards, and MENU leaves it", async () => {
    const c = chatOf("shield");
    expect(all(await say(c, "shield"))).toMatch(/Scam Shield/);
    const verdict = all(await say(c, "Dear customer your SIM will be blocked. Update KYC at http://airtel-kyc.xyz immediately"));
    expect(verdict).toMatch(/Likely a scam/);
    expect(verdict).toMatch(/Chakshu/);
    await say(c, "menu");
    expect(store.getFlow(`x`)).toBeUndefined();
  });
  it("an unprompted forwarded link gets a heads-up plus a verdict, without any command", async () => {
    const out = await say(chatOf("fwd"), "Your electricity will be cut tonight, pay now at http://bijli-bill.top/pay.apk");
    expect(out).toHaveLength(2);
    expect(all(out)).toMatch(/scam/i);
  });
  it("ordinary talk is not treated as a scam", async () => {
    const out = await say(chatOf("normal"), "I run a small kirana store in Pune");
    expect(all(out)).not.toMatch(/Scam Shield|Likely a scam/);
  });
});

describe("chat features: Network Reality Check", () => {
  it("explains fibre vs 5G AirFiber for a pincode", async () => {
    expect(all(await say(chatOf("net1"), "network 411016 Pune"))).toMatch(/5G AirFiber/);
    expect(all(await say(chatOf("net2"), "network 411001 Pune"))).toMatch(/fibre is available/i);
  });
  it("asks for the pincode when it is missing, then answers", async () => {
    const c = chatOf("net3");
    expect(all(await say(c, "network"))).toMatch(/6-digit pincode/);
    expect(all(await say(c, "411016 Pune"))).toMatch(/Network Reality Check/);
  });
  it("re-prices an open quote when fibre isn't available", async () => {
    const c = chatOf("net4");
    await say(c, "/start");
    for (const t of ["c:type:Dental clinic", "c:city:Pune", "c:emp:15", "c:gst:no", "c:cur:Home broadband", "needs:email"]) await say(c, t);
    const before = store.listSessions().find((s) => s.botChat?.chatId === c.chatId)!;
    expect(before.quote?.lines.some((l) => ["P01", "P02"].includes(l.productId))).toBe(true);
    const out = all(await say(c, "network 411016"));
    expect(out).toMatch(/updated your quote/i);
    const after = store.getSession(before.id)!;
    expect(after.quote?.lines.some((l) => l.productId === "P04")).toBe(true);
    expect(after.profile.pincode).toBe("411016");
  });
});

describe("chat features: scheduler, troubleshooter, backup, branch", () => {
  it("SCHEDULE offers slots, a number books one, and RESCHEDULE changes it", async () => {
    const { c, order } = await paidOrder("sched");
    const offer = (await say(c, "schedule"))[0];
    expect(offer.options?.length).toBeGreaterThan(3);
    expect(all(await say(c, "2"))).toMatch(/Booked/);
    expect(store.getOrder(order.id)!.slot).toBeDefined();
    expect(all(await say(c, "reschedule"))).toMatch(/Your slot is/);
    expect(all(await say(c, "1"))).toMatch(/Booked/);
    expect(store.getOrder(order.id)!.reschedules).toBe(1);
  });

  it("TROUBLE: a speed under 80% of plan raises a ticket routed to the city partner", async () => {
    const { c, order } = await paidOrder("trouble1");
    await say(c, "trouble");
    expect(all(await say(c, "1"))).toMatch(/speed test/i);
    expect(all(await say(c, "20"))).toMatch(/TKT-/);
    expect(store.getOrder(order.id)!.tickets?.[0]).toMatchObject({ kind: "slow_speed", assignedTo: "Malabar Net" });
  });

  it("TROUBLE: 'no internet' walks through checks and only then raises a ticket", async () => {
    const { c, order } = await paidOrder("trouble2");
    await say(c, "trouble");
    expect(all(await say(c, "2"))).toMatch(/power light/i);
    expect(store.getOrder(order.id)!.tickets ?? []).toHaveLength(0);
    expect(all(await say(c, "2"))).toMatch(/TKT-/);
    expect(store.getOrder(order.id)!.tickets?.[0].stepsTried).toContain("Power-cycled router");
  });

  it("BACKUP adds Backup 4G/5G Failover and re-prices the order", async () => {
    const { c, order } = await paidOrder("backup");
    const before = order.quote.monthlyWithGst;
    expect(all(await say(c, "backup"))).toMatch(/Failover added/);
    expect(store.getOrder(order.id)!.quote.monthlyWithGst).toBeGreaterThan(before);
    expect(all(await say(c, "backup"))).toMatch(/already have/i);
  });

  it("BRANCH previews, then YES creates a linked branch order that reuses KYC", async () => {
    const { c, order } = await paidOrder("branch");
    expect(all(await say(c, "branch"))).toMatch(/city and 6-digit pincode/);
    const preview = all(await say(c, "Nashik 422001"));
    expect(preview).toMatch(/Branch-in-a-Box/);
    expect(preview).toMatch(/KYC reused/);
    expect(all(await say(c, "yes"))).toMatch(/Branch created/);
    const parent = store.getOrder(order.id)!;
    expect(parent.branches).toHaveLength(1);
    const child = store.getOrder(parent.branches![0].id)!;
    expect(child.parentId).toBe(order.id);
    expect(child.consentId).toBe(parent.consentId);
  });

  it("features say so politely when there is no order yet", async () => {
    for (const cmd of ["schedule", "trouble", "branch", "backup"]) expect(all(await say(chatOf("none-" + cmd), cmd))).toMatch(/couldn't find an order/i);
  });
});
