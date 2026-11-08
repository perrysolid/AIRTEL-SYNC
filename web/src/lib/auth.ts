import crypto from "node:crypto";

/**
 * Staff sign-in for the sales portal: scrypt password hashes and a signed,
 * HTTP-only session cookie (HMAC-SHA256). No third-party auth service, so
 * the portal works the same on Render, locally and in tests.
 */

export type Role = "admin" | "sales" | "partner";
export interface StaffSession {
  sub: string;
  role: Role;
  name: string;
  exp: number;
}

export const SESSION_COOKIE = "accel_staff";
const TTL_S = 12 * 60 * 60;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Without AUTH_SECRET, derive a key from a server-only secret that is already set.
  const base = process.env.DATABASE_URL || process.env.CRON_SECRET || process.env.WHATSAPP_APP_SECRET;
  if (base) return crypto.createHash("sha256").update(`accel-staff-session:${base}`).digest("base64url");
  if (process.env.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL) throw new Error("Set AUTH_SECRET (16+ chars) for the sales portal");
  return "local-dev-only-secret-change-me";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = crypto.scryptSync(password, Buffer.from(salt, "base64url"), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}

const sign = (body: string) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

export function issueToken(s: Omit<StaffSession, "exp">, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...s, exp: Math.floor(now / 1000) + TTL_S })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readToken(token: string | undefined, now = Date.now()): StaffSession | undefined {
  if (!token) return undefined;
  const [body, mac] = token.split(".");
  if (!body || !mac) return undefined;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return undefined;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as StaffSession;
    return s.exp * 1000 > now ? s : undefined;
  } catch {
    return undefined;
  }
}

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TTL_S,
});

// Slow down password guessing: 8 failed attempts per IP per 15 minutes.
const failures = new Map<string, { n: number; until: number }>();
export function loginBlocked(ip: string, now = Date.now()) {
  const f = failures.get(ip);
  return !!f && f.n >= 8 && f.until > now;
}
export function noteLoginFailure(ip: string, now = Date.now()) {
  const f = failures.get(ip);
  const fresh = !f || f.until < now;
  failures.set(ip, { n: fresh ? 1 : f.n + 1, until: fresh ? now + 15 * 60_000 : f.until });
}
export const clearLoginFailures = (ip: string) => failures.delete(ip);
