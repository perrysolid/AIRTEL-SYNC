import crypto from "node:crypto";

/**
 * DPDP Act 2023 helpers: masking for UI/logs, consent purposes, retention.
 * Principle: we never persist document images — only the minimum extracted
 * fields needed for activation plus a SHA-256 fingerprint of each file.
 */

export const CONSENT_VERSION = "2026-07-v1";

export const PURPOSES = {
  kyc_verification: {
    required: true,
    title: "Verify your business (KYC)",
    detail: "Read your GST, Udyam, address proof and signatory ID, and check them against government registries. Required by DoT rules to activate business connections.",
    data: ["GSTIN", "Udyam number", "business name and address", "signatory name and ID number"],
    retention: "Document images are deleted right after reading. Verified details are kept for the life of the connection plus the period DoT rules require.",
  },
  service_activation: {
    required: true,
    title: "Set up and support your services",
    detail: "Schedule installation, activate SIMs and lines, bill you, and send status updates on WhatsApp/SMS.",
    data: ["contact name", "mobile number", "installation address", "products ordered"],
    retention: "Kept while you are a customer, then deleted after statutory billing retention.",
  },
  partner_assist: {
    required: false,
    title: "Let a local Accel partner help you",
    detail: "If you get stuck, share your enquiry (not your documents) with one nearby authorised partner so they can call you.",
    data: ["business name", "city", "products of interest", "mobile number"],
    retention: "Shared only for 30 days and only with one partner.",
  },
  offers: {
    required: false,
    title: "Send me offers",
    detail: "Occasional offers for business products. You can stop these any time by replying STOP.",
    data: ["mobile number", "business type"],
    retention: "Until you withdraw consent.",
  },
} as const;
export type Purpose = keyof typeof PURPOSES;

export function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** 27XUIXG0767D1ZP -> 27XUI••••••D1ZP */
export function maskGstin(g?: string | null): string {
  if (!g) return "";
  return g.length === 15 ? `${g.slice(0, 5)}••••••${g.slice(11)}` : "•••";
}

/** UDYAM-MH-00-9516696 -> UDYAM-MH-00-•••6696 */
export function maskUdyam(u?: string | null): string {
  if (!u) return "";
  return u.replace(/(\d{3})(\d{4})$/, "•••$2");
}

export function maskPhone(p?: string | null): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  return d.length >= 10 ? `+91 ••••• ${d.slice(-5)}` : "•••";
}

/** "Neha Kaur" -> "N. K." for logs; keeps UI recognisable without full PII. */
export function maskName(n?: string | null): string {
  if (!n) return "";
  return n.split(/\s+/).map((w) => (w[0] ? `${w[0].toUpperCase()}.` : "")).join(" ");
}

export function maskId(id?: string | null): string {
  if (!id) return "";
  return id.length > 4 ? `${"•".repeat(Math.max(3, id.length - 4))}${id.slice(-4)}` : "••••";
}

/** Masks anything that looks like an identifier inside free text (for logs). */
export function redactText(s: string): string {
  return s
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, (m) => maskGstin(m))
    .replace(/UDYAM-[A-Z]{2}-\d{2}-\d{7}/g, (m) => maskUdyam(m))
    .replace(/(\+?91[\s-]?)?[6-9]\d{9}\b/g, (m) => maskPhone(m))
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "•••• •••• ••••");
}
