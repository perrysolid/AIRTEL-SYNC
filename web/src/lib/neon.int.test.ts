import { describe, expect, it } from "vitest";

// Live Neon check (Postgres + Object Storage). Opt-in: NEON_IT=1 npx vitest run neon.int
if (process.env.NEON_IT) process.loadEnvFile(".env.local");
const run = process.env.NEON_IT ? describe : describe.skip;

run("Neon (live)", () => {
  it("stores records in Postgres and reads them back", async () => {
    const { pool, migrate, upsertRecords } = await import("./db");
    await migrate();
    const id = `it_${Date.now().toString(36)}`;
    await upsertRecords([{ kind: "session", id, data: { id, probe: true } }]);
    const { rows } = await pool().query("SELECT data FROM records WHERE kind = 'session' AND id = $1", [id]);
    expect(rows[0].data).toEqual({ id, probe: true });
    await pool().query("DELETE FROM records WHERE kind = 'session' AND id = $1", [id]);
  });

  it("uploads a status card to the bucket and serves it from a presigned link", async () => {
    const { store } = await import("./store");
    const { createOrder } = await import("./orders");
    const { newSession } = await import("./advisor");
    const { buildQuote } = await import("./pricing");
    const { recommend } = await import("./recommend");
    const { orderCardUrl } = await import("./cards");
    const { stageImage } = await import("./media");
    const s = newSession("web", "en");
    s.profile = { ...s.profile, businessType: "Kirana store", segment: "micro", city: "Jaipur", cityTier: 1, employees: 3, hasGstin: true, needs: ["pos_billing"] } as typeof s.profile;
    s.quote = buildQuote({ lines: recommend({ profile: s.profile }).lines, term: 12 });
    store.saveSession(s);
    const o = createOrder(s, { contactName: "Test", phone: "9812345678" });
    const staged = await stageImage({ text: "x", image: orderCardUrl(o) });
    expect(staged.image).toMatch(new RegExp(`^${process.env.AWS_ENDPOINT_URL_S3}/assets/cards/order/${o.id}/.+X-Amz-Signature=`));
    const res = await fetch(staged.image!);
    expect(res.status).toBe(200);
    expect([...new Uint8Array(await res.arrayBuffer()).slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 60_000);
});
