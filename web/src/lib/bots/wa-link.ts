import fs from "node:fs/promises";
import path from "node:path";
import { dbEnabled, pool } from "../db";
import { noteWhatsAppInbound } from "../customers";
import { botTurn, transcribeVoice, VOICE_UNAVAILABLE, documentRedirect } from "./core";
import { asPlainText, type BotMessage } from "./types";

/**
 * WhatsApp on an ordinary number, no Meta Business account: the backend links to the number as a linked device
 * (like WhatsApp Web) and answers everyone who writes, and order updates go out the same way. Set WA_LINK=on and
 * WA_LINK_NUMBER=91XXXXXXXXXX; until the number is linked, the server log prints a pairing code to type on the phone
 * (WhatsApp → Linked devices → Link with phone number instead). The login is kept in Postgres (or STORE_DIR), so
 * restarts reconnect on their own. Unofficial client: WhatsApp can restrict numbers that run bots.
 */

type Baileys = typeof import("@whiskeysockets/baileys");
type Socket = ReturnType<Baileys["default"]>;

export interface LinkStatus {
  state: "off" | "starting" | "waiting" | "pairing" | "open" | "logged_out";
  number?: string;
  since: string;
  error?: string;
}

const g = globalThis as unknown as { __waLink?: { sock?: Socket; status: LinkStatus; stopped?: boolean } };
const link = (g.__waLink ??= { status: { state: "off", since: new Date().toISOString() } });
const set = (s: Partial<LinkStatus> & Pick<LinkStatus, "state">) => (link.status = { ...link.status, error: undefined, ...s, since: new Date().toISOString() });

export const waLinkEnabled = () => process.env.WA_LINK === "on";
export const waLinkReady = () => link.status.state === "open" && !!link.sock;
export const waLinkStatus = () => link.status;
const pairNumber = () => {
  const d = (process.env.WA_LINK_NUMBER ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d || undefined;
};

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

/** Starts (or restarts) the link. A failed start, e.g. the database unreachable for a moment, is retried, never dropped. */
export async function startWaLink(): Promise<void> {
  try {
    await connect();
  } catch (err) {
    console.warn(`[wa-link] could not start (${(err as Error).message}); retrying in 30 s`);
    set({ state: "starting", error: (err as Error).message });
    setTimeout(() => void startWaLink(), 30_000);
  }
}

async function connect() {
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
      const number = pairNumber();
      if (number && !asked) {
        asked = true;
        try {
          const code = (await sock.requestPairingCode(number)).match(/.{1,4}/g)!.join("-");
          set({ state: "pairing", number });
          // The code is only useful to whoever holds the phone; it expires after a few minutes and a new one follows.
          console.log(`[wa-link] PAIRING CODE ${code}  →  on the phone: WhatsApp → Settings → Linked devices → Link a device → Link with phone number instead`);
        } catch (err) {
          set({ state: "waiting", error: `Could not get a pairing code: ${(err as Error).message}` });
          console.warn(`[wa-link] ${link.status.error}`);
        }
      } else if (!number) {
        set({ state: "waiting" });
        if (!asked) console.warn("[wa-link] not linked: set WA_LINK_NUMBER to the WhatsApp number (with 91) to get a pairing code in this log");
        asked = true;
      }
    }
    if (connection === "open") {
      set({ state: "open", number: sock.user?.id?.split(":")[0] });
      console.log(`[wa-link] linked as ${link.status.number?.slice(0, 4)}••••, answering every message`);
    }
    if (connection === "close") {
      if (link.sock !== sock) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      if (code === b.DisconnectReason.loggedOut) {
        await kv.clear();
        set({ state: "logged_out", number: undefined });
        console.warn("[wa-link] logged out from the phone; a new pairing code follows");
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
      // An unanswered pairing code expires with the connection; start the next one from a clean login.
      if (!state.creds.registered) await kv.clear().catch(() => {});
      else console.warn(`[wa-link] connection closed (${code ?? "network"}), reconnecting`);
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
    replies = heard ? await botTurn({ ...base, text: heard }) : [VOICE_UNAVAILABLE];
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
