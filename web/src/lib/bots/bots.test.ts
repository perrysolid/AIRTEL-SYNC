import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { botTurn } from "./core";
import { keyboard, telegramHtml } from "./telegram";
import { payloads } from "./whatsapp-cloud";
import { store, type BotChat } from "../store";
import { notifyOrder } from "../notify";

beforeAll(() => {
  process.env.AI_DISABLED = "1";
});
afterEach(() => vi.unstubAllGlobals());

// The store persists between runs, so every run talks from fresh chats.
const RUN = Date.now().toString(36);
const id = (k: string) => `${k}-${RUN}`;
const chat = (k: string): BotChat => ({ channel: "telegram", chatId: id(k) });

async function walk(c: BotChat, steps: string[]) {
  let last = await botTurn({ chat: c, text: "/start", firstName: "Sunita" });
  for (const text of steps) last = await botTurn({ chat: c, text, firstName: "Sunita" });
  return last;
}

describe("chat bot core", () => {
  it("greets with tappable options on /start", async () => {
    const [m] = await botTurn({ chat: chat("t1"), text: "/start" });
    expect(m.options?.length).toBeGreaterThan(3);
    expect(m.options?.[0].value).toMatch(/^type:/);
  });

  it("reaches a bundle, asks for a number on Order, then creates an order linked to the chat", async () => {
    const c = chat("t2");
    const [bundle] = await walk(c, ["c:type:Kirana store", "c:city:Jaipur", "c:emp:2", "c:gst:no", "c:cur:Mobile hotspot", "needs:pos_billing,cctv"]);
    expect(bundle.buttons?.map((b) => b.action ?? b.url)).toEqual(["a:order", expect.stringContaining("/quote/"), "human"]);
    expect(bundle.image).toContain("/api/card/quote/");

    const [ask] = await botTurn({ chat: c, text: "a:order", firstName: "Sunita" });
    expect(ask.askContact).toBe(true);

    const [done] = await botTurn({ chat: c, text: "", firstName: "Sunita", phone: "+91 98123 45678" });
    expect(done.text).toMatch(/Order ACC-/);
    const order = store.listOrders().find((o) => o.botChat?.chatId === id("t2"))!;
    expect(order.phone).toBe("9812345678");
    expect(order.contactName).toBe("Sunita");

    const [status] = await botTurn({ chat: c, text: "/status" });
    expect(status.text).toContain(order.id);
  });

  it("WhatsApp uses the sender's number, so Order needs no extra step", async () => {
    const c: BotChat = { channel: "whatsapp", chatId: `9198765${String(Date.now()).slice(-5)}` };
    const [plan] = await walk(c, ["I have a dental clinic in Pune with 8 staff, we have GST", "c:cur:Home broadband", "needs:email"]);
    // WhatsApp reply buttons can't open links: "Adjust plan" answers with a link button instead.
    expect(plan.buttons?.map((b) => b.action)).toEqual(["a:order", "a:adjust", "human"]);
    const [adjust] = await botTurn({ chat: c, text: "a:adjust" });
    expect(adjust.buttons?.[0].url).toContain("/quote/");
    const [m] = await botTurn({ chat: c, text: "a:order", phone: c.chatId, firstName: "Asha" });
    expect(m.text).toMatch(/Order ACC-/);
  });

  it("accepts '1,3' for multi-select on text channels", async () => {
    const c: BotChat = { channel: "whatsapp", chatId: `9187654${String(Date.now()).slice(-5)}` };
    const [needs] = await walk(c, ["c:type:Kirana store", "c:city:Jaipur", "c:emp:2", "c:gst:no", "c:cur:Mobile hotspot"]);
    expect(needs.multi).toBe(true);
    const [bundle] = await botTurn({ chat: c, text: "1,2", phone: c.chatId });
    expect(bundle.buttons?.some((b) => b.action === "a:order")).toBe(true);
  });

  it("pushes order updates to the chat the order came from", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return Response.json({ ok: true, result: { message_id: 1 } });
    }));
    const order = store.listOrders().find((o) => o.botChat?.chatId === id("t2"))!;
    notifyOrder(order, "✅ Business verified");
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toContain("/bot123:abc/sendMessage");
    expect(calls[0].body).toMatchObject({ chat_id: id("t2") });
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("with a public URL, each update arrives as the live status card with the text as caption", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.PUBLIC_BASE_URL = "https://demo.example.com";
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return Response.json({ ok: true, result: { message_id: 1 } });
    }));
    const order = store.listOrders().find((o) => o.botChat?.chatId === id("t2"))!;
    notifyOrder(order, ["💳 Payment received", "✅ Mobile lines live"]);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toContain("/sendPhoto");
    expect(calls[0].body.photo).toMatch(/^https:\/\/demo\.example\.com\/api\/card\/order\/ACC-/);
    expect(calls[0].body.caption).toBe("💳 Payment received\n✅ Mobile lines live");
    expect(JSON.stringify(calls[0].body.reply_markup)).toContain(`/order/${order.id}`);
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.PUBLIC_BASE_URL;
  });
});

describe("channel rendering", () => {
  const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Option number ${i + 1} with a long label`, value: `v${i}` }));

  it("WhatsApp: ≤3 options become reply buttons, more become a list, multi becomes numbered text", () => {
    expect(payloads({ text: "Pick", options: opts(3) })[0]).toMatchObject({ type: "interactive", interactive: { type: "button" } });
    const list = payloads({ text: "Pick", options: opts(8) })[0] as { interactive: { type: string; action: { sections: { rows: { title: string }[] }[] } } };
    expect(list.interactive.type).toBe("list");
    expect(list.interactive.action.sections[0].rows.every((r) => r.title.length <= 24)).toBe(true);
    const multi = payloads({ text: "Pick", options: opts(4), multi: true })[0] as { text: { body: string } };
    expect(multi.text.body).toContain("4. Option");
  });

  it("WhatsApp: long text is sent before the interactive prompt", () => {
    const out = payloads({ text: "x".repeat(1500), buttons: [{ label: "Order", action: "a:order" }] });
    expect(out.map((p) => p.type)).toEqual(["text", "interactive"]);
  });

  it("WhatsApp: card, text and buttons arrive as one message (image header)", () => {
    process.env.PUBLIC_BASE_URL = "https://demo.example.com";
    const link = payloads({ text: "**Day 1 of 5**", image: "https://demo.example.com/api/card/order/ACC-1", buttons: [{ label: "Open live tracker", url: "https://demo.example.com/order/ACC-1" }] });
    expect(link).toHaveLength(1);
    expect(link[0]).toMatchObject({ type: "interactive", interactive: { type: "cta_url", header: { type: "image", image: { link: "https://demo.example.com/api/card/order/ACC-1" } }, body: { text: "*Day 1 of 5*" } } });
    // An uploaded card (media id) with reply buttons: still one message.
    const quote = payloads({ text: "Your plan", image: "x", buttons: [{ label: "Order this plan", action: "a:order" }] }, { id: "123" });
    expect(quote).toEqual([expect.objectContaining({ interactive: expect.objectContaining({ type: "button", header: { type: "image", image: { id: "123" } } }) })]);
    // Lists can't carry an image header: card (with caption) first, then the list.
    const list = payloads({ text: "Pick", image: "x", options: Array.from({ length: 5 }, (_, i) => ({ label: `o${i}`, value: `v${i}` })) }, { id: "9" });
    expect(list.map((p) => p.type)).toEqual(["image", "interactive"]);
    // Without a public URL or upload, Meta can't fetch the card: plain text with the link inline.
    delete process.env.PUBLIC_BASE_URL;
    const local = payloads({ text: "Day 1", image: "http://localhost/x.png", buttons: [{ label: "Tracker", url: "http://localhost/order/1" }] });
    expect(local.map((p) => p.type)).toEqual(["text"]);
  });

  it("Telegram: bold, ticks and contact keyboard", () => {
    expect(telegramHtml({ text: "**Biz Fibre** <fast>" })).toBe("<b>Biz Fibre</b> &lt;fast&gt;");
    const kb = keyboard({ text: "", options: opts(3), multi: true, picked: ["v1"] }) as { inline_keyboard: { text: string; callback_data: string }[][] };
    expect(kb.inline_keyboard[0][1].text.startsWith("✅")).toBe(true);
    expect(kb.inline_keyboard.at(-1)![0].callback_data).toBe("md");
    expect(keyboard({ text: "", askContact: true })).toMatchObject({ keyboard: [[{ request_contact: true }]] });
  });
});
