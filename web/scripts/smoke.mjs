// End-to-end smoke test of the whole journey against a running server.
//   BASE=http://localhost:3000 node scripts/smoke.mjs
// Advisor -> quote -> order -> consent -> Smart KYC on real specimen images ->
// e-sign -> pay -> staged activation -> WhatsApp STATUS.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const APPLICANT = process.env.APPLICANT ?? "K03";
const ok = (cond, msg) => {
  if (!cond) {
    console.error("✗", msg);
    process.exit(1);
  }
  console.log("✓", msg);
};

async function advisor(sessionId, message) {
  const r = await fetch(`${BASE}/api/advisor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, message, language: "en", forceGuided: process.env.FORCE_GUIDED === "1" }) });
  const events = (await r.text()).split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
  return { sessionId: events.find((e) => e.type === "session")?.sessionId, events, text: events.filter((e) => e.type === "text").map((e) => e.delta).join("") };
}
const post = async (p, body) => {
  const r = await fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};

const t0 = Date.now();
let a = await advisor(undefined, "");
ok(a.text.length > 10, `advisor greets (${a.events.find((e) => e.type === "session").mode} mode)`);
const sid = a.sessionId;
a = await advisor(sid, "I run a woodcraft furniture workshop in Nagpur with 12 people, we have GST. Need internet, CCTV and email for staff");
for (let i = 0; i < 6 && !a.events.some((e) => e.type === "bundle"); i++) a = await advisor(sid, a.events.some((e) => e.type === "chips" && e.mode === "multi") ? "needs:cctv,email" : "yes");
const bundle = a.events.find((e) => e.type === "bundle");
ok(bundle, `bundle recommended: ${bundle?.quote.lines.filter((l) => l.active).map((l) => l.productId).join(", ")} = ₹${bundle?.quote.monthly}/mo`);

const q = await post("/api/quote", { sessionId: sid, term: 24, toggles: {} });
ok(q.status === 200 && q.json.quote.term === 24, `quote re-priced for 24 months: ₹${q.json.quote.monthly}/mo`);

const o = await post("/api/order", { sessionId: sid, contactName: "Joseph Singh", phone: "9876543210" });
ok(o.status === 200, `order created ${o.json.orderId}`);
const orderId = o.json.orderId;

const blocked = await fetch(`${BASE}/api/kyc/extract`, { method: "POST", body: (() => { const f = new FormData(); f.set("orderId", orderId); return f; })() });
ok(blocked.status === 403, "document reading is blocked until consent is given");

const c = await post("/api/kyc/consent", { orderId, purposes: { kyc_verification: true, service_activation: true } });
ok(c.status === 200, `consent recorded (ledger hash ${c.json.hash.slice(0, 10)}…)`);

const docs = {};
const dir = path.join(process.cwd(), "public", "kyc");
for (const t of ["gst_certificate", "udyam_certificate", "address_proof", "signatory_id"]) {
  const file = path.join(dir, `${APPLICANT}_${t}.png`);
  if (!fs.existsSync(file)) continue;
  const fd = new FormData();
  fd.set("orderId", orderId);
  fd.set("docType", t);
  fd.set("file", new File([fs.readFileSync(file)], path.basename(file), { type: "image/png" }));
  const r = await fetch(`${BASE}/api/kyc/extract`, { method: "POST", body: fd });
  const j = await r.json();
  ok(r.status === 200, `read ${t} via ${j.engine} in ${j.ms}ms`);
  docs[j.docType] = j.doc;
}
const v = await post("/api/kyc/verify", { orderId, docs });
ok(v.json.kyc.verdict === "verified", `KYC ${v.json.kyc.verdict}: ${v.json.kyc.summary}`);

ok((await post(`/api/order/${orderId}/action`, { action: "esign", otp: "123456" })).status === 200, "agreement e-signed");
const paid = await post(`/api/order/${orderId}/action`, { action: "pay", method: "upi_autopay" });
ok(paid.json.payment, `paid ₹${paid.json.payment.amount}`);
let ord = paid.json;
while (ord.timeline.clockDay < ord.liveDay) ord = (await post(`/api/order/${orderId}/action`, { action: "next_day" })).json;
ok(ord.steps.every((s) => s.done), `all services live on day ${ord.liveDay} · ${ord.notifications.length} WhatsApp updates sent`);

const wa = await fetch(`${BASE}/api/whatsapp`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: "whatsapp:+919876543210", Body: "STATUS" }) });
ok((await wa.text()).includes(orderId), "WhatsApp STATUS returns the live order");

const con = await (await fetch(`${BASE}/api/console`)).json();
ok(con.orders.some((x) => x.id === orderId) && !JSON.stringify(con.orders).includes("9876543210"), "order visible in partner console with phone masked");
console.log(`\nJourney complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
