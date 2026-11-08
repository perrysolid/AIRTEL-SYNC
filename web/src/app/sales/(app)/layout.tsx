import { requireStaff } from "@/lib/staff-session";
import { SalesNav } from "./SalesNav";

export const dynamic = "force-dynamic";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <SalesNav staff={{ name: staff.name, role: staff.role, region: staff.region, partnerCode: staff.partnerCode }} />
      <main className="min-w-0 px-4 pt-6 pb-20 sm:px-8 lg:pt-10">{children}</main>
    </div>
  );
}
