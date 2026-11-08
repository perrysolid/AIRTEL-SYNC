import crypto from "node:crypto";

/**
 * Mobile sign-in codes by SMS or a voice call through 2Factor (2factor.in). 2Factor generates
 * and checks the code; we only keep its session id. Sends are rate-limited
 * per number and per IP so the form can't be used to burn SMS credit.
 */

// TWOFACTOR_BASE_URL exists only to point tests at a stand-in server.
const BASE = process.env.TWOFACTOR_BASE_URL ?? "https://2factor.in/API/V1";

export const otpEnabled = () => !!process.env.TWOFACTOR_API_KEY;

interface Pending {
  phone: string;
  via: OtpVia;
  providerSession: string;
  expires: number;
  attempts: number;
}

const g = globalThis as unknown as { __otp?: Map<string, Pending>; __otpSends?: Map<string, number[]> };
const pending = (g.__otp ??= new Map<string, Pending>());
const sends = (g.__otpSends ??= new Map<string, number[]>());

const TTL_MS = 10 * 60_000;
const LIMITS = { perPhone: [3, 10 * 60_000], perIp: [10, 60 * 60_000] } as const;

function allow(key: string, [max, windowMs]: readonly [number, number], at: number) {
  const recent = (sends.get(key) ?? []).filter((t) => t > at - windowMs);
  if (recent.length >= max) return false;
  sends.set(key, [...recent, at]);
  return true;
}

async function twoFactor(path: string): Promise<{ Status: string; Details: string }> {
  const key = process.env.TWOFACTOR_API_KEY;
  if (!key) throw new Error("TWOFACTOR_API_KEY not set");
  const r = await fetch(`${BASE}/${encodeURIComponent(key)}/${path}`, { signal: AbortSignal.timeout(15_000) });
  const j = (await r.json().catch(() => ({ Status: "Error", Details: r.statusText }))) as { Status: string; Details: string };
  return j;
}

export type OtpVia = "sms" | "call";
const ROUTE: Record<OtpVia, string> = { sms: "SMS", call: "VOICE" };

export type SendResult = { requestId: string } | { error: string; status: number };

/** Sends a code to 91XXXXXXXXXX by SMS, or reads it out in a phone call. Returns an opaque request id the browser sends back with the code. */
export async function sendOtp(phone: string, ip: string, at = Date.now(), via: OtpVia = "sms"): Promise<SendResult> {
  if (!otpEnabled()) return { error: "Sign-in by SMS isn't set up on this server yet.", status: 503 };
  if (!allow(`ip:${ip}`, LIMITS.perIp, at)) return { error: "Too many codes requested from this network. Try again in an hour.", status: 429 };
  if (!allow(`ph:${phone}`, LIMITS.perPhone, at)) return { error: "We've sent 3 codes to this number. Wait 10 minutes and try again.", status: 429 };
  const j = await twoFactor(`${ROUTE[via]}/+${phone}/AUTOGEN`).catch((e: Error) => ({ Status: "Error", Details: e.message }));
  if (j.Status !== "Success") {
    console.warn(`[otp] 2Factor send failed: ${j.Details}`);
    return { error: "We couldn't send the code just now. Check the number and try again.", status: 502 };
  }
  const requestId = crypto.randomBytes(16).toString("base64url");
  pending.set(requestId, { phone, via, providerSession: j.Details, expires: at + TTL_MS, attempts: 0 });
  return { requestId };
}

export type VerifyResult = { phone: string } | { error: string; status: number };

export async function verifyOtp(requestId: string, code: string, at = Date.now()): Promise<VerifyResult> {
  const p = pending.get(requestId);
  if (!p || p.expires < at) return { error: "This code has expired. Request a new one.", status: 410 };
  if (!/^\d{4,8}$/.test(code)) return { error: "Enter the code we sent you.", status: 400 };
  if (++p.attempts > 5) {
    pending.delete(requestId);
    return { error: "Too many wrong codes. Request a new one.", status: 429 };
  }
  const j = await twoFactor(`${ROUTE[p.via]}/VERIFY/${encodeURIComponent(p.providerSession)}/${code}`).catch((e: Error) => ({ Status: "Error", Details: e.message }));
  if (j.Status === "Success" && /match/i.test(j.Details)) {
    pending.delete(requestId);
    return { phone: p.phone };
  }
  return { error: "That code doesn't match. Check it and try again.", status: 401 };
}

export const resetOtpForTests = () => {
  pending.clear();
  sends.clear();
};
