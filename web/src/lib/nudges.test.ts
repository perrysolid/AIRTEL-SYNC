import { afterEach, describe, expect, it, vi } from "vitest";
import { newSession } from "./advisor";
import { runNudges, waitingStep } from "./nudges";
import { createOrder } from "./orders";
import { buildQuote } from "./pricing";
import { recommend } from "./recommend";
import { store } from "./store";

const RUN = Date.now().toString(36);
const HOUR = 3600_000;

function quotedChatSession(chatId: string) {
  const s = newSession("telegram", "en");
  s.profile = { ...s.profile, businessType: "Bakery", segment: "micro", city: "Pune", cityTier: 1, employees: 4, hasGstin: true, needs: ["pos_billing"] } as typeof s.profile;
  s.quote = buildQuote({ lines: recommend({ profile: s.profile }).lines, term: 12 });
  s.status = "quoted";
  s.botChat = { channel: "telegram", chatId };
  s.transcript.push({ role: "user", text: "bakery in pune", at: new Date(Date.now() - 3 * HOUR).toISOString() });
  store.saveSession(s);
  s.updatedAt = new Date(Date.now() - 3 * HOUR).toISOString();
  return s;
}

describe("stall reminders", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("reminds once about a saved plan and once per waiting order step, inside the 24 h window", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    const texts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      texts.push(body.text ?? body.caption ?? "");
      return Response.json({ ok: true, result: { message_id: 1 } });
    }));

    const plan = quotedChatSession(`n1-${RUN}`);
    const stale = quotedChatSession(`n2-${RUN}`);
    stale.transcript.at(-1)!.at = new Date(Date.now() - 30 * HOUR).toISOString(); // outside the window

    const ordered = quotedChatSession(`n3-${RUN}`);
    const o = createOrder(ordered, { contactName: "Ravi", phone: "9812345678", botChat: ordered.botChat });
    o.notifications.forEach((n) => (n.at = new Date(Date.now() - 3 * HOUR).toISOString()));
    expect(waitingStep(o)).toBe("kyc");

    const sent = await runNudges();
    expect(sent).toContain(plan.id);
    expect(sent).not.toContain(stale.id);
    expect(sent).toContain(o.id);
    await vi.waitFor(() => expect(texts.some((t) => t.includes("Verify your business"))).toBe(true));
    expect(texts.some((t) => t.includes("is saved"))).toBe(true);

    const again = await runNudges();
    expect(again).not.toContain(plan.id);
    expect(again).not.toContain(o.id);
  });
});
