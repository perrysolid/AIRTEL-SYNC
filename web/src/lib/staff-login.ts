import { clearLoginFailures, issueToken, loginBlocked, noteLoginFailure, verifyPassword } from "./auth";
import { staffByEmail } from "./crm";
import { store } from "./store";

/** One sign-in check for the portal form and the API: rate-limited per IP, audited. */
export async function authenticate(email: string, password: string, ip: string): Promise<{ token: string } | { error: string; status: number }> {
  if (loginBlocked(ip)) return { error: "Too many attempts. Try again in 15 minutes.", status: 429 };
  const staff = await staffByEmail(email);
  if (!staff || !verifyPassword(password, staff.passwordHash)) {
    noteLoginFailure(ip);
    store.audit("anonymous", "staff.login_failed", email.slice(0, 60));
    return { error: "That email and password don't match an Accel staff account.", status: 401 };
  }
  clearLoginFailures(ip);
  store.audit(staff.id, "staff.login", staff.email);
  return { token: issueToken({ sub: staff.id, role: staff.role, name: staff.name }) };
}
