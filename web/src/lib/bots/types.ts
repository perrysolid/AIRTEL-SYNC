import type { Chip } from "../advisor-types";

export interface BotButton {
  label: string;
  /** Opens a web page (quote, KYC, tracker). */
  url?: string;
  /** Sent back to the bot when tapped, e.g. "a:order". */
  action?: string;
}

/** One outgoing chat message, rendered natively by each channel. */
export interface BotMessage {
  text: string;
  options?: Chip[];
  multi?: boolean;
  /** Ticked options while a multi-select is in progress (Telegram). */
  picked?: string[];
  buttons?: BotButton[];
  askContact?: boolean;
  /** Public URL of a card image (plan or order status) shown above the text. */
  image?: string;
}

/** Converts the advisor's light markdown to plain chat formatting. */
export function chatText(s: string, bold: (t: string) => string) {
  return s
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, (_, t) => bold(t))
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

/** Where owners open links and chat apps fetch cards; Render's own URL if none is set. */
const baseUrl = () => process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

export function publicUrl(path: string) {
  return `${baseUrl().replace(/\/$/, "")}${path}`;
}

/** Chat apps refuse buttons (and can't fetch cards) at localhost; fall back to inline links. */
export function linkButtonsAllowed() {
  const u = baseUrl();
  return u.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(u);
}

/** Plain-text rendering for transports without native buttons (Twilio, a linked WhatsApp device). */
export function asPlainText(m: BotMessage): string {
  let t = chatText(m.text, (x) => `*${x}*`);
  if (m.options?.length) t += "\n\n" + m.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n") + (m.multi ? "\n\n_Reply with all the numbers that apply, e.g. 1,3_" : "");
  for (const b of m.buttons ?? []) t += b.url ? `\n\n${b.label}: ${b.url}` : b.action === "a:order" ? "\n\nReply *ORDER* to go ahead." : "";
  return t;
}
