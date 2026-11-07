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
}

/** Converts the advisor's light markdown to plain chat formatting. */
export function chatText(s: string, bold: (t: string) => string) {
  return s
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, (_, t) => bold(t))
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

export function publicUrl(path: string) {
  return `${(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

/** Chat apps refuse buttons that point at localhost; fall back to inline links. */
export function linkButtonsAllowed() {
  const u = process.env.PUBLIC_BASE_URL ?? "";
  return u.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(u);
}
