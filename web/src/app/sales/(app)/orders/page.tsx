import Link from "next/link";
import { inr } from "@/lib/format";
import { maskPhone } from "@/lib/privacy";
import { orderStage, ordersFor } from "@/lib/sales-data";
import { requireStaff } from "@/lib/staff-session";
import { Kpi, PageHead } from "../ui";

export default async function Orders() {
  const staff = await requireStaff();
  const orders = await ordersFor(staff);
  const paid = orders.filter((o) => o.payment);
  const stuck = orders.filter((o) => !o.payment && Date.now() - new Date(o.createdAt).getTime() > 2 * 3_600_000);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead title="Orders" sub={staff.role === "partner" ? `Orders placed with your partner code ${staff.partnerCode} or from your leads` : "Every digital order, from the web advisor, WhatsApp and Telegram"} />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi accent label="Orders" value={String(orders.length)} />
        <Kpi label="Paid and activating" value={String(paid.length)} />
        <Kpi label="Monthly value, paid" value={inr(paid.reduce((s, o) => s + o.quote.monthly, 0))} note="before GST" />
        <Kpi label="Stuck over 2 hours" value={String(stuck.length)} note="Call these owners" />
      </div>
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-rule text-ink-soft">
            <tr><th className="px-5 py-3 font-medium">Business</th><th className="px-3 py-3 font-medium">Stage</th><th className="px-3 py-3 font-medium">Monthly</th><th className="px-3 py-3 font-medium">Channel</th><th className="px-3 py-3 font-medium">Contact</th><th className="px-3 py-3 font-medium">Placed</th></tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {orders.map((o) => {
              const stage = orderStage(o);
              return (
                <tr key={o.id} className="hover:bg-paper">
                  <td className="px-5 py-3"><Link href={`/order/${o.id}`} className="font-semibold hover:underline">{o.businessName}</Link><div className="font-mono text-xs text-ink-soft">{o.id}{o.leadId ? `, lead ${o.leadId}` : ""}</div></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stage === "Live" ? "bg-ok/12 text-ok" : stage.startsWith("Activating") ? "bg-[#2a78d6]/10 text-[#1d5fae]" : stage.includes("attention") ? "bg-bad/10 text-bad" : "bg-marigold/15 text-marigold-deep"}`}>{stage}</span></td>
                  <td className="px-3 py-3 tabular-nums">{inr(o.quote.monthly)}</td>
                  <td className="px-3 py-3 text-ink-soft">{o.channel}{o.partnerCode ? `, ${o.partnerCode}` : ""}</td>
                  <td className="px-3 py-3 text-ink-soft">{o.contactName}, {maskPhone(o.phone)}</td>
                  <td className="px-3 py-3 text-ink-soft">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                </tr>
              );
            })}
            {!orders.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-soft">No orders yet. Orders placed with your partner code show up here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
