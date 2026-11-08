import fs from "node:fs/promises";
import path from "node:path";
import { dbEnabled, pool } from "../db";
import { noteWhatsAppInbound } from "../customers";
import { botTurn, transcribeVoice, VOICE_UNAVAILABLE, documentRedirect } from "./core";
import { asPlainText, type BotMessage } from "./types";

/**
 * WhatsApp on an ordinary number, no Meta Business account: the backend links to the number as a linked device
 * (like WhatsApp Web) and answers everyone who writes, and order updates go out the same way. An admin links it once
 * from the staff portal with a pairing code; the login is kept in Postgres (or STORE_DIR) so restarts reconnect on
 * their own. On with WA_LINK=on. Unofficial client: WhatsApp can restrict numbers that run bots.
 */

type Baileys = typeof import("@whiskeysockets/baileys");
type Socket = ReturnType<Baileys["default"]>;

export interface LinkStatus {
  state: "off" | "starting" | "waiting" | "pairing" | "open" | "logged_out";
  number?: string;
  code?: string;
  since: string;
  error?: string;
}

const g = globalThis as unknown as { __waLink?: { sock?: Socket; status: LinkStatus; pairNumber?: string; stopped?: boolean } };
const link = (g.__waLink ??= { status: { state: "off", since: new Date().toISOString() } });
const set = (s: Partial<LinkStatus> & Pick<LinkStatus, "state">) => (link.status = { ...link.status, error: undefined, ...s, since: new Date().toISOString() });

export const waLinkEnabled = () => process.env.WA_LINK === "on";
export const waLinkReady = () => link.status.state === "open" && !!link.sock;
export const waLinkStatus = () => link.status;

// --- Login storage: one row per key, the same layout as Baileys' multi-file store.
const DIR = path.join(process.env.STORE_DIR || path.join(process.cwd(), ".data"), "wa-auth");
const kv = {
  async get(key: string) {
    if (dbEnabled()) return (await pool().query<{ value: string }>("SELECT value FROM wa_auth WHERE key = $1", [key])).rows[0]?.value;
    return fs.readFile(path.join(DIR, `${key.replace(/[/:]/g, "_")}.json`), "utf8").catch(() => undefined);
  },
  async set(key: string, value: string) {
    if (dbEnabled()) await pool().query("INSERT INTO wa_auth (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
    else await fs.mkdir(DIR, { recursive: true }).then(() => fs.writeFile(path.join(DIR, `${key.replace(/[/:]/g, "_")}.json`), value));
  },
  async del(key: string) {
    if (dbEnabled()) await pool().query("DELETE FROM wa_auth WHERE key = $1", [key]);
    else await fs.rm(path.join(DIR, `${key.replace(/[/:]/g, "_")}.json`), { force: true });
  },
  async clear() {
    if (dbEnabled()) await pool().query("DELETE FROM wa_auth");
    else await fs.rm(DIR, { recursive: true, force: true });
  },
};

async function authState(b: Baileys) {
  const read = async (key: string) => {
    const v = await kv.get(key);
    return v ? JSON.parse(v, b.BufferJSON.reviver) : null;
  };
  const write = (key: string, data: unknown) => kv.set(key, JSON.stringify(data, b.BufferJSON.replacer));
  const creds = (await read("creds")) ?? b.initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const out: Record<string, unknown> = {};
          await Promise.all(
            ids.map(async (id) => {
              let v = await read(`${type}-${id}`);
              if (type === "app-state-sync-key" && v) v = b.proto.Message.AppStateSyncKeyData.fromObject(v);
              out[id] = v;
            }),
          );
          return out;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const jobs: Promise<unknown>[] = [];
          for (const type in data) for (const id in data[type]) jobs.push(data[type][id] ? write(`${type}-${id}`, data[type][id]) : kv.del(`${type}-${id}`));
          await Promise.all(jobs);
        },
      },
    },
    saveCreds: () => write("creds", creds),
  };
}

// --- Connection

export async function startWaLink() {
  if (!waLinkEnabled() || link.stopped) return;
  const b = await import("@whiskeysockets/baileys");
  const { state, saveCreds } = await authState(b);
  const pino = (await import("pino")).default;
  set({ state: "starting", number: state.creds.me?.id?.split(":")[0] });
  const sock = b.default({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auth: state as any,
    logger: pino({ level: "silent" }),
    browser: b.Browsers.macOS("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  link.sock = sock;
  sock.ev.on("creds.update", () => void saveCreds());

  let asked = false;
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr && !state.creds.registered) {
      if (link.pairNumber && !asked) {
        asked = true;
        try {
          const code = await sock.requestPairingCode(link.pairNumber);
          set({ state: "pairing", number: link.pairNumber, code });
          console.log(`[wa-link] pairing code ready for ${link.pairNumber.slice(0, 4)}••••`);
        } catch (err) {
          set({ state: "waiting", error: `Could not get a pairing code: ${(err as Error).message}` });
        }
      } else if (!link.pairNumber && link.status.state !== "pairing") set({ state: "waiting" });
    }
    if (connection === "open") {
      link.pairNumber = undefined;
      set({ state: "open", number: sock.user?.id?.split(":")[0], code: undefined });
      console.log(`[wa-link] linked as ${link.status.number?.slice(0, 4)}••••, answering every message`);
    }
    if (connection === "close") {
      if (link.sock !== sock) return; // a newer socket took over
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      if (code === b.DisconnectReason.loggedOut) {
        await kv.clear();
        set({ state: "logged_out", number: undefined, code: undefined });
        console.warn("[wa-link] logged out from the phone; link again from the staff portal");
        setTimeout(() => void startWaLink(), 2_000);
        return;
      }
      if (code === b.DisconnectReason.connectionReplaced) {
        // Another server instance (a deploy rolling over) holds the link now.
        console.warn("[wa-link] link taken over by another instance; this one stops");
        link.stopped = true;
        set({ state: "off" });
        return;
      }
      console.warn(`[wa-link] connection closed (${code ?? "network"}), reconnecting`);
      setTimeout(() => void startWaLink(), code === b.DisconnectReason.restartRequired ? 0 : 3_000);
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) void handle(sock, b, m).catch((err) => console.warn(`[wa-link] ${(err as Error).message}`));
  });
}

/** A phone number from a WhatsApp id; newer chats may use a private "@lid" id, with the number alongside. */
const phoneOf = (...jids: (string | null | undefined)[]) => jids.find((j) => j?.endsWith("@s.whatsapp.net"))?.split("@")[0].split(":")[0];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handle(sock: Socket, b: Baileys, m: any) {
  const jid: string | undefined = m.key.remoteJid;
  if (m.key.fromMe || !jid || jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@newsletter") || !m.message) return;
  const from = phoneOf(jid, m.key.remoteJidAlt, m.key.senderPn) ?? jid.split("@")[0];
  const x = m.message;
  const chat = { channel: "whatsapp" as const, chatId: from };
  const base = { chat, firstName: (m.pushName as string | undefined)?.split(" ")[0], phone: from };
  noteWhatsAppInbound(from);
  await sock.readMessages([m.key]).catch(() => {});
  await sock.sendPresenceUpdate("composing", jid).catch(() => {});

  let replies: BotMessage[];
  const text: string = (x.conversation ?? x.extendedTextMessage?.text ?? x.buttonsResponseMessage?.selectedButtonId ?? x.listResponseMessage?.singleSelectReply?.selectedRowId ?? "").trim();
  if (text) replies = await botTurn({ ...base, text: /^order$/i.test(text) ? "a:order" : text });
  else if (x.audioMessage) {
    const data = (await b.downloadMediaMessage(m, "buffer", {})) as Buffer;
    const heard = await transcribeVoice(data, x.audioMessage.mimetype ?? "audio/ogg");
    replies = heard ? [{ text: `🎙️ _${heard}_` }, ...(await botTurn({ ...base, text: heard }))] : [VOICE_UNAVAILABLE];
  } else if (x.imageMessage || x.documentMessage) replies = [documentRedirect(chat)];
  else replies = [{ text: "Sorry, I can read text and voice notes. Type HELP to see what I can do." }];

  for (const r of replies) await sendTo(sock, jid, r);
  await sock.sendPresenceUpdate("paused", jid).catch(() => {});
}

async function sendTo(sock: Socket, jid: string, msg: BotMessage) {
  const text = asPlainText(msg);
  if (msg.image && !/localhost/.test(msg.image)) {
    try {
      await sock.sendMessage(jid, { image: { url: msg.image }, caption: text });
      return;
    } catch {
      // Card could not be fetched: send the words alone.
    }
  }
  await sock.sendMessage(jid, { text });
}

/** Order updates and reminders through the linked number. */
export async function sendLinked(to: string, msg: BotMessage) {
  if (!waLinkReady()) throw new Error("WhatsApp link is not connected");
  const phone = to.replace(/\D/g, "");
  await sendTo(link.sock!, `${phone.length === 10 ? `91${phone}` : phone}@s.whatsapp.net`, msg);
}

/** Admin: link a number (returns once the pairing code is ready) or start over. */
export async function pairWaLink(number: string): Promise<LinkStatus> {
  const digits = number.replace(/\D/g, "");
  link.pairNumber = digits.length === 10 ? `91${digits}` : digits;
  link.stopped = false;
  await resetSocket(false);
  for (let i = 0; i < 40 && link.status.state !== "pairing" && link.status.state !== "open" && !link.status.error; i++) await new Promise((r) => setTimeout(r, 500));
  return link.status;
}

export async function unlinkWaLink() {
  try {
    await link.sock?.logout();
  } catch {
    // Not linked: nothing to log out.
  }
  await resetSocket(true);
  return link.status;
}

async function resetSocket(clearLogin: boolean) {
  const old = link.sock;
  link.sock = undefined;
  old?.end(undefined);
  // A fresh pairing starts from a fresh login.
  if (clearLogin || link.pairNumber) await kv.clear();
  await startWaLink();
}
