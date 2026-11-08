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
  it("seeds demo staff whose password works, scoped books, and a ranked call queue", async () => {
    const { staffByEmail, visibleLeads, callQueue, demoPassword, leadViews } = await import("./crm");
    const { verifyPassword } = await import("./auth");
    const priya = (await staffByEmail("PRIYA@accel.demo"))!;
    expect(priya.role).toBe("sales");
    expect(verifyPassword(demoPassword(), priya.passwordHash)).toBe(true);

    const mine = await visibleLeads(priya);
    expect(mine.length).toBeGreaterThan(100);
    expect(mine.every((l) => l.owner === "st_priya" && l.region === "North")).toBe(true);
    expect(mine.some((l) => l.row.lead_source === "Channel partner")).toBe(false);

    const all = await visibleLeads({ id: "st_manager", role: "admin" });
    expect(all).toHaveLength((await leadViews()).size);

    const q = await callQueue(priya, new Date());
    const fresh = q.fresh.map((l) => l.score.probability);
    expect(fresh).toEqual([...fresh].sort((a, b) => b - a));
    expect([...q.due, ...q.fresh].every((l) => ["to_call", "contacted", "interested", "quote_sent"].includes(l.status))).toBe(true);
  });

  it("logging a call updates status and books the follow-up", async () => {
    const { logActivity, leadViews, callQueue } = await import("./crm");
    const lead = [...(await leadViews()).values()].find((l) => l.owner === "st_arjun" && l.status === "to_call" && !l.lastTouch)!;
    const tomorrow = new Date(Date.now() + 86_400_000);
    await logActivity({ leadId: lead.id, staffId: "st_arjun", kind: "call", outcome: "Connected", status: "interested", note: "Wants CCTV", nextAt: tomorrow.toISOString() });
    const v = (await leadViews()).get(lead.id)!;
    expect(v.status).toBe("interested");
    expect(v.lastTouch?.note).toBe("Wants CCTV");
    const dueTomorrow = await callQueue({ id: "st_arjun", role: "sales" }, tomorrow);
    expect(dueTomorrow.due.some((l) => l.id === lead.id)).toBe(true);
  });
});
