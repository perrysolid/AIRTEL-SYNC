import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// A throwaway file store so tests never touch Neon or the dev data.
beforeAll(() => {
  delete process.env.DATABASE_URL;
  process.env.STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "crm-"));
});

describe("sales records", () => {
  it("has three people (salesman, supervisor, manager) and no made-up leads or calls", async () => {
    const { staffByEmail, listStaff, demoPassword, leadViews, activitySince } = await import("./crm");
    const { verifyPassword } = await import("./auth");
    expect((await listStaff()).map((s) => s.role).sort()).toEqual(["admin", "sales", "supervisor"]);
    const rahul = (await staffByEmail("SALESMAN@accel.demo"))!;
    expect(rahul.role).toBe("sales");
    expect(verifyPassword(demoPassword(), rahul.passwordHash)).toBe(true);
    expect((await leadViews()).size).toBe(0);
    expect(await activitySince(new Date(0))).toHaveLength(0);
  });

  it("a call request becomes a lead for the salesman; only he and the supervisor can work it", async () => {
    const { newSession } = await import("./advisor");
    const { store, now } = await import("./store");
    const { leadViews, visibleLeads, callQueue, logActivity } = await import("./crm");
    const s = newSession("web", "en");
    s.status = "handoff";
    s.callback = { phone: "919876543210", name: "Meena", when: "Now", at: now() };
    s.handoff = { reason: "Asked for a call back (now)", at: now(), summary: "" };
    s.profile = { ...s.profile, businessType: "Clinic", city: "Pune" };
    store.saveSession(s);

    const lead = [...(await leadViews()).values()][0];
    expect(lead.owner).toBe("st_salesman");
    expect(lead.status).toBe("to_call");
    expect(lead.phone).toBe("919876543210");
    expect(lead.score.band).toBe("hot");
    expect(await visibleLeads({ id: "st_supervisor", role: "supervisor" })).toHaveLength(1);
    expect(await visibleLeads({ id: "st_other", role: "sales" })).toHaveLength(0);

    const tomorrow = new Date(Date.now() + 86_400_000);
    await logActivity({ leadId: lead.id, staffId: "st_salesman", kind: "call", outcome: "Connected", status: "interested", note: "Wants CCTV", nextAt: tomorrow.toISOString() });
    const v = (await leadViews()).get(lead.id)!;
    expect(v.status).toBe("interested");
    expect(v.lastTouch?.note).toBe("Wants CCTV");
    expect((await callQueue({ id: "st_salesman", role: "sales" }, tomorrow)).due.map((l) => l.id)).toContain(lead.id);
  });

  it("the same number on WhatsApp joins the existing lead instead of making a second one", async () => {
    const { newSession } = await import("./advisor");
    const { store } = await import("./store");
    const { leadViews } = await import("./crm");
    const s = newSession("whatsapp", "hi");
    s.botChat = { channel: "whatsapp", chatId: "919876543210" };
    s.status = "handoff";
    store.saveSession(s);
    const book = [...(await leadViews()).values()];
    expect(book).toHaveLength(1);
    expect(book[0].sessionIds).toContain(s.id);
  });

  it("the supervisor's draft report counts what happened today", async () => {
    const { draftReport } = await import("./team-report");
    const text = await draftReport();
    expect(text).toMatch(/Rahul Deshmukh: 1 call \(1 connected\)/);
    expect(text).toMatch(/Priya Malhotra: nothing logged today/);
  });
});
