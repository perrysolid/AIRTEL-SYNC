import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueCustomerToken, issueToken, readCustomerToken, readTelegramLinkCode, readToken, telegramLinkCode } from "./auth";
import { customerByPhone, customerForChat, startDemoCustomer, linkTelegram, memoryBrief, noteWhatsAppInbound, normalizePhone, rememberSession, signInCustomer } from "./customers";
import { notifyOrder } from "./notify";
import { redeemWhatsAppCode, resetOtpForTests, sendOtp, verifyOtp } from "./otp";
import { botTurn } from "./bots/core";
import { newSession } from "./advisor";
import { store, type Order } from "./store";
import { buildTimeline } from "./tracker";

// The file store persists between runs, so every run uses fresh numbers.
const RUN = Date.now() % 1_000_000;
const phone = (n: number) => `9${String(RUN).padStart(6, "0")}${String(n).padStart(3, "0")}`;

beforeEach(() => resetOtpForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TWOFACTOR_API_KEY;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_UPDATE_TEMPLATE;
});

function order(tenDigits: string): Order {
  const o = {
    id: `ACC-T${RUN}${tenDigits.slice(-3)}`,
    createdAt: new Date().toISOString(),
    businessName: "Sharma Kirana",
    phone: tenDigits,
    contactName: "Ramesh Sharma",
    channel: "web",
    profile: { needs: [] },
    lines: [],
    term: 12,
    quote: { monthlyWithGst: 1415 },
    timeline: buildTimeline(["P01"]),
    notifications: [],
  } as unknown as Order;
  return store.saveOrder(o);
}

describe("phone numbers", () => {
  it("accepts the usual ways people type an Indian mobile", () => {
    for (const v of ["9876543210", "+91 98765 43210", "09876543210", "919876543210"]) expect(normalizePhone(v)).toBe("919876543210");
    for (const v of ["12345", "5876543210", "+1 555 136 9092"]) expect(normalizePhone(v)).toBeUndefined();
  });
});

describe("OTP sign-in through 2Factor", () => {
  it("sends a code, verifies it, and never accepts a wrong one", async () => {
    process.env.TWOFACTOR_API_KEY = "test-key";
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes("/AUTOGEN")) return Response.json({ Status: "Success", Details: "sess-123" });
      return Response.json(url.endsWith("/482913") ? { Status: "Success", Details: "OTP Matched" } : { Status: "Error", Details: "OTP Mismatch" });
    }));
    const sent = await sendOtp("919812345678", "1.2.3.4");
    expect(urls[0]).toBe("https://2factor.in/API/V1/test-key/SMS/+919812345678/AUTOGEN");
    if (!("requestId" in sent)) throw new Error("not sent");
    expect(await verifyOtp(sent.requestId, "111111")).toMatchObject({ status: 401 });
    expect(urls[1]).toContain("/SMS/VERIFY/sess-123/111111");
    expect(await verifyOtp(sent.requestId, "482913")).toEqual({ phone: "919812345678" });
    expect(await verifyOtp(sent.requestId, "482913")).toMatchObject({ status: 410 }); // one use only
  });

  it("limits codes per number so the form can't burn SMS credit", async () => {
    process.env.TWOFACTOR_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ Status: "Success", Details: "s" })));
    for (let i = 0; i < 3; i++) expect(await sendOtp("919812345679", `ip${i}`)).toHaveProperty("requestId");
    expect(await sendOtp("919812345679", "ip9")).toMatchObject({ status: 429 });
  });

  it("can read the code out in a phone call instead", async () => {
    process.env.TWOFACTOR_API_KEY = "test-key";
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      return Response.json(url.includes("/AUTOGEN") ? { Status: "Success", Details: "voice-1" } : { Status: "Success", Details: "OTP Matched" });
    }));
    const sent = await sendOtp("919812345670", "1.2.3.5", Date.now(), "call");
    if (!("requestId" in sent)) throw new Error("not sent");
    expect(urls[0]).toContain("/VOICE/+919812345670/AUTOGEN");
    expect(await verifyOtp(sent.requestId, "1234")).toEqual({ phone: "919812345670" });
    expect(urls[1]).toContain("/VOICE/VERIFY/voice-1/1234");
  });

  it("LOGIN on WhatsApp replies with a code that signs in as that number, once", async () => {
    process.env.AI_DISABLED = "1";
    const [m] = await botTurn({ chat: { channel: "whatsapp", chatId: "919812300001" }, text: "LOGIN", phone: "919812300001" });
    const code = m.text.match(/\*\*(\d{6})\*\*/)?.[1];
    expect(code).toBeDefined();
    expect(redeemWhatsAppCode(code!, "ip-wa")).toEqual({ phone: "919812300001" });
    expect(redeemWhatsAppCode(code!, "ip-wa")).toMatchObject({ status: 401 });
    const [tg] = await botTurn({ chat: { channel: "telegram", chatId: "tg-login" }, text: "/login" });
    expect(tg.text).not.toMatch(/\d{6}/);
  });

  it("is off without a 2Factor key", async () => {
    expect(await sendOtp("919812345678", "1.2.3.4")).toMatchObject({ status: 503 });
  });
});

describe("customer sessions", () => {
  it("a customer cookie is never a staff session, and the reverse", () => {
    const c = issueCustomerToken("cus_0123456789abcdef");
    expect(readCustomerToken(c)).toBe("cus_0123456789abcdef");
    expect(readToken(c)).toBeUndefined();
    expect(readCustomerToken(issueToken({ sub: "st_manager", role: "admin", name: "Kavita" }))).toBeUndefined();
  });

  it("Telegram link codes fit in a deep link and expire after 15 minutes", () => {
    const code = telegramLinkCode("cus_0123456789abcdef");
    expect(`l_${code}`.length).toBeLessThanOrEqual(64);
    expect(`l_${code}`).toMatch(/^[\w-]+$/);
    expect(readTelegramLinkCode(code)).toBe("cus_0123456789abcdef");
    expect(readTelegramLinkCode(code, Date.now() + 16 * 60_000)).toBeUndefined();
    expect(readTelegramLinkCode(code.replace(/.$/, (ch) => (ch === "a" ? "b" : "a")))).toBeUndefined();
  });
});

describe("memory", () => {
  it("sign-in picks up the earlier conversation and orders on that number; the brief remembers it", () => {
    const p = phone(1);
    const o = order(p);
    const s = newSession("web", "hi");
    s.profile = { businessType: "Kirana store", city: "Indore", employees: 2, monthlySpend: 700, needs: ["pos_billing", "backup_internet"] };
    s.declinedProducts = ["P23"];
    store.saveSession(s);
    const c = signInCustomer(`91${p}`, { sessionId: s.id });
    expect(c.orderIds).toContain(o.id);
    expect(c.name).toBe("Ramesh");
    expect(store.getSession(s.id)?.customerId).toBe(c.id);
    const brief = memoryBrief(c);
    expect(brief).toContain("Kirana store");
    expect(brief).toContain("Indore");
    expect(brief).toContain("₹700/month");
    expect(brief).toContain(o.id);
  });

  it("later conversations add to the memory instead of replacing it", () => {
    const c = signInCustomer(`91${phone(2)}`);
    const a = newSession("web", "en");
    a.profile = { city: "Pune", needs: ["internet"] };
    rememberSession(c, a);
    const b = newSession("whatsapp", "hi");
    b.profile = { employees: 4, needs: ["cctv"] };
    rememberSession(c, b);
    expect(c.profile).toMatchObject({ city: "Pune", employees: 4 });
    expect(c.profile.needs).toEqual(["internet", "cctv"]);
    expect(c.language).toBe("hi");
  });

  it("finds the customer behind a WhatsApp number or a linked Telegram chat", () => {
    const c = signInCustomer(`91${phone(3)}`);
    expect(customerForChat({ channel: "whatsapp", chatId: `91${phone(3)}` })?.id).toBe(c.id);
    linkTelegram(c.id, `tg-${RUN}`);
    expect(customerForChat({ channel: "telegram", chatId: `tg-${RUN}` })?.id).toBe(c.id);
  });
});

describe("automatic updates", () => {
  const waBodies = (calls: { url: string; body: Record<string, unknown> }[]) => calls.filter((c) => c.url.includes("/messages")).map((c) => c.body);

  function stubMeta() {
    process.env.WHATSAPP_TOKEN = "t";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: typeof init.body === "string" ? JSON.parse(init.body) : {} });
      return Response.json({ id: "media-1", messages: [{ id: "wamid.1" }] });
    }));
    return calls;
  }

  it("goes to the verified WhatsApp number as a rich message while the 24-hour window is open", async () => {
    const p = phone(4);
    const o = order(p);
    signInCustomer(`91${p}`);
    noteWhatsAppInbound(`91${p}`);
    const calls = stubMeta();
    notifyOrder(o, "✅ Business verified");
    await vi.waitFor(() => expect(waBodies(calls).length).toBeGreaterThan(0));
    const [msg] = waBodies(calls);
    expect(msg.to).toBe(`91${p}`);
    expect(msg.type).not.toBe("template");
    expect(JSON.stringify(msg)).toContain("Business verified");
  });

  it("uses the approved template once the window has closed", async () => {
    const p = phone(5);
    const o = order(p);
    const c = signInCustomer(`91${p}`);
    c.whatsappInboundAt = new Date(Date.now() - 30 * 3600_000).toISOString();
    process.env.WHATSAPP_UPDATE_TEMPLATE = "order_update";
    const calls = stubMeta();
    notifyOrder(o, ["💳 Payment received", "📶 Fibre live"]);
    await vi.waitFor(() => expect(waBodies(calls)).toHaveLength(1));
    expect(waBodies(calls)[0]).toMatchObject({ to: `91${p}`, type: "template", template: { name: "order_update" } });
    expect(JSON.stringify(waBodies(calls)[0])).toContain("💳 Payment received 📶 Fibre live");
  });

  it("never messages a number nobody verified", async () => {
    const o = order(phone(6));
    expect(customerByPhone(`91${phone(6)}`)).toBeUndefined();
    const calls = stubMeta();
    notifyOrder(o, "✅ Business verified");
    await new Promise((r) => setTimeout(r, 50));
    expect(waBodies(calls)).toHaveLength(0);
    expect(o.notifications.at(-1)?.text).toBe("✅ Business verified"); // still shown in the app
  });

  it("a demo account is pre-filled and never messaged on WhatsApp", async () => {
    const c = startDemoCustomer();
    expect(memoryBrief(c)).toContain("Indore");
    const o = order(phone(8));
    c.orderIds.push(o.id);
    c.phone = `91${phone(8)}`; // even if a demo account somehow matched a real number
    store.saveCustomer(c);
    const calls = stubMeta();
    notifyOrder(o, "✅ Business verified");
    await new Promise((r) => setTimeout(r, 50));
    expect(waBodies(calls)).toHaveLength(0);
  });

  it("customers can switch WhatsApp updates off", async () => {
    const p = phone(7);
    const o = order(p);
    const c = signInCustomer(`91${p}`);
    noteWhatsAppInbound(`91${p}`);
    c.notify.whatsapp = false;
    const calls = stubMeta();
    notifyOrder(o, "✅ Business verified");
    await new Promise((r) => setTimeout(r, 50));
    expect(waBodies(calls)).toHaveLength(0);
  });
});
