"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { TopBar } from "@/components/Brand";
import type { PublicOrder } from "@/lib/order-view";
import { ConsentStep } from "./ConsentStep";
import { KycStep } from "./KycStep";
import { EsignStep, PayStep } from "./SignPay";
import { Tracker } from "./Tracker";
import { WhatsAppFeed } from "./WhatsAppFeed";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PublicOrder>();
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/order/${id}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error);
    else setOrder(j);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) return <main className="mx-auto max-w-xl px-4 py-16 text-center text-lg">{error}. Check the order ID in your WhatsApp message.</main>;
  if (!order) return <div className="grid h-dvh place-items-center text-ink-soft"><Loader2 className="animate-spin" /></div>;

  const stage = !order.consentId ? "consent" : order.kyc?.verdict !== "verified" ? "kyc" : !order.esign ? "esign" : !order.payment ? "pay" : "track";

  return (
    <div className="min-h-dvh pb-16">
      <TopBar>
        <span className="font-mono text-xs text-ink-soft">{order.id}</span>
      </TopBar>
      <main className="mx-auto max-w-xl px-4">
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{order.businessName}</h1>
        <p className="text-ink-soft">{order.city}{order.city && " · "}{order.lines.length} services · {order.term} months</p>

        {order.parentId && (
          <p className="mt-3 rounded-xl border border-rule bg-sheet p-3 text-sm">🏪 Branch of <Link href={`/order/${order.parentId}`} className="font-semibold underline underline-offset-2">{order.parentId}</Link>. Consent, KYC and agreement were reused from head office.</p>
        )}
        {order.pendingDocs.length > 0 && (
          <p className="mt-3 rounded-xl border border-marigold-deep bg-marigold/15 p-3 text-sm"><b>Still needed:</b> {order.pendingDocs.join(", ")}.</p>
        )}
        <ol className="mt-5 grid grid-cols-5 gap-1" aria-label="Progress">
          {order.steps.map((s, i) => {
            const current = order.steps.findIndex((x) => !x.done) === i;
            return (
              <li key={s.key} className="text-center" aria-current={current ? "step" : undefined}>
                <div className={`h-1.5 rounded-full ${s.done ? "bg-ok" : current ? "bg-marigold" : "bg-rule"}`} />
                <div className={`mt-1.5 text-[11px] leading-tight ${current ? "font-bold" : "text-ink-soft"}`}>{s.label}</div>
              </li>
            );
          })}
        </ol>

        <div className="mt-6">
          {stage === "consent" && <ConsentStep orderId={order.id} onDone={refresh} />}
          {stage === "kyc" && <KycStep order={order} onUpdate={setOrder} />}
          {stage === "esign" && <EsignStep order={order} onUpdate={setOrder} />}
          {stage === "pay" && <PayStep order={order} onUpdate={setOrder} />}
          {stage === "track" && <Tracker order={order} onUpdate={setOrder} />}
        </div>

        <WhatsAppFeed order={order} />
      </main>
    </div>
  );
}
