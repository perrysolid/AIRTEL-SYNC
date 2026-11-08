import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readToken, SESSION_COOKIE, type Role } from "./auth";
import { staffById, type Staff } from "./crm";

export type SignedInStaff = Omit<Staff, "passwordHash">;

/** The signed-in staff member for this request, re-read from the staff table (so a removed account stops working). */
export async function currentStaff(): Promise<SignedInStaff | undefined> {
  const s = readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return undefined;
  const staff = await staffById(s.sub);
  if (!staff) return undefined;
  return { id: staff.id, email: staff.email, name: staff.name, role: staff.role, region: staff.region, partnerCode: staff.partnerCode };
}

export async function requireStaff(roles?: Role[]): Promise<SignedInStaff> {
  const s = await currentStaff();
  if (!s) redirect("/sales/login");
  if (roles && !roles.includes(s.role)) redirect("/sales");
  return s;
}
