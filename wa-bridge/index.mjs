/**
 * WhatsApp bridge: links to a normal WhatsApp account as a linked device (like WhatsApp Web) and answers every
 * message with the same Udyam bot the website and Telegram use. No Meta Business approval needed.
 *
 *   WA_NUMBER=91XXXXXXXXXX npm start      first run: prints a pairing code to enter on the phone
 *   npm start                             later runs reuse the saved login in ./auth
 *
 * BACKEND_URL (default the live Render app) is where the bot runs; replies come back from its /api/whatsapp form endpoint.
 * This is an unofficial client: fine for a demo, but WhatsApp can restrict numbers that bots run on.
 */
import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

const BACKEND = (process.env.BACKEND_URL ?? "https://airtel-sync.onrender.com").replace(/\/$/, "");
const NUMBER = (process.env.WA_NUMBER ?? "").replace(/\D/g, "");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-IN"), ...a);

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** A phone number from a WhatsApp id, if it carries one (newer chats may use a private "@lid" id instead). */
const phoneOf = (...jids) => jids.find((j) => j?.endsWith("@s.whatsapp.net"))?.split("@")[0].split(":")[0];

function textOf(m) {
  const x = m.message ?? {};
  return (
    x.conversation ??
    x.extendedTextMessage?.text ??
    x.buttonsResponseMessage?.selectedButtonId ??
    x.listResponseMessage?.singleSelectReply?.selectedRowId ??
    x.imageMessage?.caption ??
    ""
  ).trim();
}

async function ask(from, text, name) {
  const r = await fetch(`${BACKEND}/api/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: `whatsapp:+${from}`, Body: text, ProfileName: name ?? "" }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) throw new Error(`backend ${r.status}`);
  const m = (await r.text()).match(/<Message>([\s\S]*)<\/Message>/);
  return m ? unxml(m[1]).trim() : "";
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: pino({ level: "silent" }), browser: Browsers.macOS("Chrome"), markOnlineOnConnect: false });
  sock.ev.on("creds.update", saveCreds);

  let asked = false;
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr && !state.creds.registered) {
      if (NUMBER && !asked) {
        asked = true;
        const code = await sock.requestPairingCode(NUMBER);
        log(`\n\n  Pairing code: ${code.match(/.{1,4}/g).join("-")}\n\n  On the phone: WhatsApp → Settings → Linked devices → Link a device → "Link with phone number instead", then type the code.\n`);
      } else if (!NUMBER) {
        log("Scan this with WhatsApp → Settings → Linked devices → Link a device (or set WA_NUMBER for a pairing code):");
        qrcode.generate(qr, { small: true });
      }
    }
    if (connection === "open") log(`✅ Linked as ${sock.user?.id?.split(":")[0]}. Replying to every message through ${BACKEND}`);
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) return log("Logged out from the phone. Delete the auth folder and start again to relink.");
      log(`Connection closed (${code ?? "network"}), reconnecting…`);
      setTimeout(start, 3_000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      const jid = m.key.remoteJid;
      if (m.key.fromMe || !jid || jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;
      const text = textOf(m);
      if (!text) {
        await sock.sendMessage(jid, { text: "I can read text messages here. Type *Hi* to start." });
        continue;
      }
      // The bot keys the conversation (and order updates) on the phone number; fall back to the private id when hidden.
      const from = phoneOf(jid, m.key.remoteJidAlt, m.key.senderPn) ?? jid.split("@")[0];
      log(`← ${from.slice(0, 4)}•••• ${text.slice(0, 60)}`);
      try {
        await sock.readMessages([m.key]);
        await sock.sendPresenceUpdate("composing", jid);
        const reply = await ask(from, text, m.pushName);
        if (reply) await sock.sendMessage(jid, { text: reply });
        log(`→ replied (${reply.length} chars)`);
      } catch (err) {
        log(`reply failed: ${err.message}`);
        await sock.sendMessage(jid, { text: "Sorry, I'm slow right now. Please send that again in a minute." }).catch(() => {});
      } finally {
        await sock.sendPresenceUpdate("paused", jid).catch(() => {});
      }
    }
  });
}

start();
