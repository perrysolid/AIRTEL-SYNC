import { describe, expect, it } from "vitest";
import { hashPassword, issueToken, loginBlocked, noteLoginFailure, readToken, verifyPassword } from "./auth";

describe("staff auth", () => {
  it("hashes with a salt and verifies only the right password", () => {
    const h = hashPassword("s3cret-pass");
    expect(h).toMatch(/^scrypt\$/);
    expect(hashPassword("s3cret-pass")).not.toBe(h);
    expect(verifyPassword("s3cret-pass", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(verifyPassword("s3cret-pass", "plain")).toBe(false);
  });

  it("session tokens are signed and expire", () => {
    const t = issueToken({ sub: "st_priya", role: "sales", name: "Priya" }, 0);
    expect(readToken(t, 1000)).toMatchObject({ sub: "st_priya", role: "sales" });
    expect(readToken(t, 13 * 3_600_000)).toBeUndefined();
    const [body, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), role: "admin" })).toString("base64url");
    expect(readToken(`${forged}.${mac}`, 1000)).toBeUndefined();
    expect(readToken(undefined)).toBeUndefined();
  });

  it("blocks an IP after 8 failed sign-ins", () => {
    const ip = `test-${Date.now()}`;
    for (let i = 0; i < 7; i++) noteLoginFailure(ip, 0);
    expect(loginBlocked(ip, 1)).toBe(false);
    noteLoginFailure(ip, 0);
    expect(loginBlocked(ip, 1)).toBe(true);
    expect(loginBlocked(ip, 16 * 60_000)).toBe(false);
  });
});
