// End-to-end smoke test of the features added on nanki, against a running server.
//   BASE=http://localhost:3000 node scripts/smoke-extras.mjs
// Scam Shield, Network Reality Check, order -> install slot -> health & backup -> tickets -> Branch-in-a-Box,
// then the same features as chat commands over the WhatsApp (Twilio-format) webhook, plus the console views.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const APPLICANT = process.env.APPLICANT ?? "K03";
let failed = 0;
const ok = (cond, msg) => {
  console.log(cond ? "✓" : "✗", msg);
  if (!cond) failed++;
};
const post = async (p, body) => {
  const r = await fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const get = async (p) => {
  const r = await fetch(`${BASE}${p}`, { cache: "no-store" });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
async function advisor(sessionId, message) {
  const r = await fetch(`${BASE}/api/advisor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, message, language: "en", forceGuided: true }) });
  const events = (await r.text()).split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
  return { sessionId: events.find((e) => e.type === "session")?.sessionId, events };
}
const wa = async (from, body) => {
  const r = await fetch(`${BASE}/api/whatsapp`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: `whatsapp:+${from}`, Body: body }) });
  return (await r.text()).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
};

// ---------------------------------------------------------------- Scam Shield
const scams = [
  ["Dear customer your Airtel SIM will be blocked today. Update KYC at http://airtel-kyc-update.xyz", "scam"],
  ["Sir please share the OTP you just received", "scam"],
  ["Payment successful Rs 2,400 paid to Raju UPI Ref 4421 will reflect shortly", "suspicious"],
  ["Hi, are we meeting at 5 pm tomorrow?", "clear"],
];
for (const [text, want] of scams) ok((await post("/api/scam", { text })).json.verdict === want, `Scam Shield: "${text.slice(0, 42)}…" → ${want}`);
ok((await post("/api/scam", { text: "आपका खाता बंद हो जाएगा। तुरंत केवाईसी अपडेट करें और ओटीपी बताओ", lang: "hi" })).json.label === "ठगी की आशंका", "Scam Shield answers in Hindi");
ok((await post("/api/scam", { text: "" })).status === 400, "Scam Shield rejects an empty message");
{
  const file = path.join(process.cwd(), "public", "kyc", `${APPLICANT}_address_proof.png`);
  if (fs.existsSync(file)) {
    const fd = new FormData();
    fd.set("file", new File([fs.readFileSync(file)], "shot.png", { type: "image/png" }));
    const r = await fetch(`${BASE}/api/scam/image`, { method: "POST", body: fd });
    const j = await r.json();
    ok(r.status === 200 && typeof j.ocrText === "string" && j.ocrText.length > 5, `Scam Shield reads a screenshot on-device (${j.verdict})`);
  }
  const fd = new FormData();
  fd.set("file", new File([Buffer.from("not an image")], "x.png", { type: "image/png" }));
  const bad = await fetch(`${BASE}/api/scam/image`, { method: "POST", body: fd });
  ok(bad.status === 400 || bad.status === 422, `Scam Shield survives a corrupt upload (${bad.status}, not a crash)`);
}

// ------------------------------------------------------ Network Reality Check
ok((await post("/api/network", { pincode: "411016", city: "Pune" })).json.recommended === "airfiber", "Network check: 411016 → 5G AirFiber fallback");
ok((await post("/api/network", { pincode: "411001", city: "Pune" })).json.recommended === "fibre", "Network check: 411001 → fibre");
ok((await post("/api/network", { pincode: "12" })).status === 422, "Network check rejects a bad pincode");

// quote session: fibre bundle flips to AirFiber when the pincode has no fibre, and back
let a = await advisor(undefined, "");
const sid = a.sessionId;
a = await advisor(sid, "I run a dental clinic in Pune with 15 staff, we have GST. Need business email for staff");
for (let i = 0; i < 4 && !a.events.some((e) => e.type === "bundle"); i++) a = await advisor(sid, a.events.some((e) => e.type === "chips" && e.mode === "multi") ? "needs:email" : "yes");
const before = (await post("/api/quote", { sessionId: sid, toggles: {} })).json.quote;
ok(before.lines.some((l) => ["P01", "P02"].includes(l.productId)), "clinic quote starts on fibre");
const flipped = await post("/api/network", { pincode: "411016", sessionId: sid });
ok(flipped.json.changed === true && flipped.json.quote.lines.some((l) => l.productId === "P04"), `quote re-priced onto 5G AirFiber for 411016 (₹${flipped.json.quote?.monthlyWithGst}/mo)`);
const back = await post("/api/network", { pincode: "411001", sessionId: sid });
ok(back.json.changed === true && back.json.quote.lines.some((l) => ["P01", "P02"].includes(l.productId)), "…and back to fibre for 411001");

// ---------------------------------------------------- a paid, activating order
const o = await post("/api/order", { sessionId: sid, contactName: "Joseph Singh", phone: "9876501234" });
ok(o.status === 200, `order created ${o.json.orderId}`);
const id = o.json.orderId;
await post("/api/kyc/consent", { orderId: id, purposes: { kyc_verification: true, service_activation: true } });
const docs = {};
for (const t of ["gst_certificate", "udyam_certificate", "address_proof", "signatory_id"]) {
  const file = path.join(process.cwd(), "public", "kyc", `${APPLICANT}_${t}.png`);
  if (!fs.existsSync(file)) continue;
  const fd = new FormData();
  fd.set("orderId", id);
  fd.set("docType", t);
  fd.set("file", new File([fs.readFileSync(file)], path.basename(file), { type: "image/png" }));
  const j = await (await fetch(`${BASE}/api/kyc/extract`, { method: "POST", body: fd })).json();
  docs[j.docType] = j.doc;
}
await post("/api/kyc/verify", { orderId: id, docs });
await post(`/api/order/${id}/action`, { action: "esign", otp: "123456" });
const paid = await post(`/api/order/${id}/action`, { action: "pay", method: "upi_autopay" });
ok(!!paid.json.payment, "order paid, activation started");

// ----------------------------------------------------------- install scheduler
const slots = (await get(`/api/order/${id}/slots`)).json;
ok(Array.isArray(slots) && slots.length >= 6, `${slots.length} installation slots offered`);
const s1 = await post(`/api/order/${id}/schedule`, { slotId: slots[2].id });
ok(s1.status === 200 && s1.json.slot?.id === slots[2].id, `slot booked: ${s1.json.slot?.label}`);
ok((await post(`/api/order/${id}/schedule`, { slotId: slots[3].id })).json.reschedules === 1, "rescheduled once");
await post(`/api/order/${id}/schedule`, { slotId: slots[4].id });
const third = await post(`/api/order/${id}/schedule`, { slotId: slots[5].id });
ok(third.status === 409 && /partner/i.test(third.json.error), "a third change is refused (two free reschedules) and hands over to a partner");
ok((await post(`/api/order/${id}/schedule`, { slotId: "2020-01-01|nope" })).status === 409, "an unknown slot is refused");
const afterSlot = (await get(`/api/order/${id}`)).json;
ok(afterSlot.slot && afterSlot.timeline.tracks.find((t) => t.key === "internet").steps.find((s) => s.key === "installed").dueDay === afterSlot.slot.day, "the install step moved to the chosen day");

// ------------------------------------------------------------- health & backup
let c = (await get(`/api/order/${id}/continuity?sales_per_hour=1000&dependent_pct=50&hours=4`)).json;
ok(c.estLossMonth === 2000 && c.hasFailover === false && c.canAddFailover === true, `backup estimate: loss ₹${c.estLossMonth}/mo vs backup ₹${c.failoverMonthlyWithGst}/mo`);
c = (await post(`/api/order/${id}/outage`, { action: "start" })).json;
ok(c.outageActive && c.incidents[0].failover === false, "outage without backup → offline");
let o2 = (await get(`/api/order/${id}`)).json;
ok(o2.tickets.length === 1 && o2.tickets[0].kind === "outage" && o2.tickets[0].slaHours === 4, `…ticket ${o2.tickets[0]?.id} raised automatically with a 4h SLA, routed to ${o2.tickets[0]?.assignedTo}`);
await post(`/api/order/${id}/outage`, { action: "end" });
o2 = (await get(`/api/order/${id}`)).json;
ok(o2.tickets[0].status === "Resolved" && !o2.outageActive, "…resolved when the link is restored");
const monthlyBefore = o2.quote.monthlyWithGst;
const fo = await post(`/api/order/${id}/failover`, {});
ok(fo.status === 200 && fo.json.hasFailover && fo.json.quote.monthlyWithGst > monthlyBefore, `Backup 4G/5G added: ₹${monthlyBefore} → ₹${fo.json.quote?.monthlyWithGst}/mo`);
c = (await post(`/api/order/${id}/outage`, { action: "start" })).json;
ok(c.incidents[0].failover === true && c.incidents[0].switchSeconds === 8, "outage with backup → online on backup in 8 seconds");
await post(`/api/order/${id}/outage`, { action: "end" });
ok((await post(`/api/order/${id}/tickets`, { kind: "billing", detail: "Charge looks wrong" })).json.slaHours === 24, "billing ticket gets a 24h SLA");

// ---------------------------------------------------------------- Branch-in-a-Box
const pv = await post(`/api/order/${id}/branch`, { name: "Aundh", city: "Pune", pincode: "411016" });
ok(pv.status === 200 && pv.json.network.recommended === "airfiber" && pv.json.kycReused === true, "branch preview: Aundh (411016) falls back to 5G AirFiber, KYC reused");
ok(pv.json.totalAfter === monthlyBefore + (fo.json.quote.monthlyWithGst - monthlyBefore) + pv.json.quote.monthlyWithGst, "branch preview total = head office (with backup) + branch");
ok((await post(`/api/order/${id}/branch`, { name: "X", city: "Atlantis", pincode: "411016" })).status === 422, "a city Accel doesn't serve is refused");
const br = await post(`/api/order/${id}/branch`, { name: "FC Road", city: "Pune", pincode: "411001", confirm: true });
ok(br.status === 200 && br.json.order.parentId === id && br.json.order.pendingDocs.length === 1, `branch order ${br.json.order?.id} created, still needs: ${br.json.order?.pendingDocs?.[0]}`);
ok(br.json.order.consentId === afterSlot.consentId && br.json.order.kyc?.verdict === "verified", "branch reused consent and verified KYC");
ok((await get(`/api/order/${id}`)).json.branches.some((b) => b.id === br.json.order.id), "head office order lists its branch");

// --------------------------------------------------- the same features in chat
const phone = "919876501234";
ok(/Scam Shield/.test(await wa(phone, "SHIELD")), "chat: SHIELD");
ok(/Likely a scam/.test(await wa(phone, "Your SIM will be blocked, update KYC at http://jio-kyc.xyz now")), "chat: forwarded scam judged");
await wa(phone, "MENU");
ok(/5G AirFiber/.test(await wa(phone, "NETWORK 411016 Pune")), "chat: NETWORK 411016");
ok(/Pick an installation slot|Your slot is/.test(await wa(phone, "SCHEDULE")), "chat: SCHEDULE offers slots");
await wa(phone, "MENU");
await wa(phone, "TROUBLE");
await wa(phone, "1");
ok(/TKT-/.test(await wa(phone, "20")), "chat: TROUBLE → slow speed raises a ticket");
ok(/already have/i.test(await wa(phone, "BACKUP")), "chat: BACKUP knows it is already added");
ok(/Branch-in-a-Box/.test(await wa(phone, "BRANCH") + (await wa(phone, "Nashik 422001"))), "chat: BRANCH preview");
await wa(phone, "MENU");
ok(/Order ACC-/.test(await wa(phone, "STATUS")), "chat: STATUS still works (existing feature unharmed)");

// ----------------------------------------------------------------------- console
const con = (await get("/api/console")).json;
ok(con.service.tickets.length >= 3 && con.service.branches >= 1 && con.service.booked >= 1, `console: ${con.service.tickets.length} tickets, ${con.service.branches} branch, ${con.service.booked} slot(s) booked`);
ok(!JSON.stringify(con).includes("9876501234"), "console still masks phone numbers");

// lead rescue: a chat-born lead with a quote but no order can be nudged; a web-only or already-ordered one cannot.
// (The console only *lists* a quoted lead after a 2-minute grace period, so take the session id from the bot's quote link.)
const rescueChat = "919800077788";
let last = "";
for (const m of ["Hi", "c:type:Kirana store", "c:city:Jaipur", "c:emp:2", "c:gst:no", "needs:pos_billing"]) last = await wa(rescueChat, m);
const leadId = last.match(/\/quote\/([a-z]+_[a-f0-9]+)/)?.[1];
ok(!!leadId, `chat lead has a saved quote (${leadId})`);
if (leadId) {
  const n = await post("/api/console/nudge", { sessionId: leadId });
  ok(n.json.ok === true && /ORDER/.test(n.json.sent), "console: nudge sent in the lead's own chat, with the exact next step");
}
ok((await post("/api/console/nudge", { sessionId: sid })).status === 409, "console: an already-ordered lead is not nudged");
ok((await post("/api/console/nudge", { sessionId: "nope" })).status === 404, "console: an unknown lead is a clean 404");

// pages render
for (const p of ["/", "/shield", "/network", "/solutions", "/products", "/how-it-works", "/help", "/console", "/privacy", "/whatsapp", `/order/${id}`]) {
  const r = await fetch(`${BASE}${p}`);
  ok(r.status === 200, `page ${p} → 200`);
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll extras checks passed");
process.exit(failed ? 1 : 0);
