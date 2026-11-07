"use client";

import { useState } from "react";
import { FileSignature, IndianRupee } from "lucide-react";
import type { PublicOrder } from "@/lib/order-view";
import { inr } from "@/lib/format";

async function act(orderId: string, body: object) {
  const r = await fetch(`/api/order/${orderId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  return j as PublicOrder;
}

export function EsignStep({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  return (
    <section>
      <h2 className="text-2xl font-extrabold">Sign your agreement</h2>
      <p className="mt-1 text-ink-soft">One page, in plain words: {order.lines.length} services for {inr(order.quote.monthlyWithGst)}/month incl. GST, {order.term} months. Signed with an Aadhaar OTP — no printing, no courier.</p>
      <div className="mt-4 rounded-xl border border-rule bg-sheet p-4">
        <ul className="space-y-1 text-[15px]">
          {order.lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-2"><span>{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</span><span className="tabular-nums">{inr(l.monthly)}</span></li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-soft">Cancel within 7 days of activation for a full refund. After that, early exit costs the setup discount you received, nothing more.</p>
      </div>
      {!otpSent ? (
        <button onClick={() => setOtpSent(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-marigold px-4 py-3.5 text-lg font-extrabold text-ink">
          <FileSignature size={20} /> Send OTP to my Aadhaar-linked mobile
        </button>
      ) : (
        <form
          className="mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              onUpdate(await act(order.id, { action: "esign", otp }));
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <label className="block text-sm font-semibold" htmlFor="otp">Enter the 6-digit OTP <span className="font-normal text-ink-soft">(demo: any 6 digits)</span></label>
          <div className="mt-1 flex gap-2">
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="min-w-0 flex-1 rounded-lg border border-rule bg-sheet px-3 py-2.5 text-center font-mono text-xl tracking-[0.4em]" />
            <button disabled={otp.length !== 6} className="rounded-lg bg-ink px-5 font-semibold text-white disabled:opacity-40">Sign</button>
          </div>
          {error && <p role="alert" className="mt-2 text-bad">{error}</p>}
        </form>
      )}
    </section>
  );
}

export function PayStep({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const [busy, setBusy] = useState(false);
  const due = order.quote.monthlyWithGst + order.quote.setupTotal;
  return (
    <section>
      <h2 className="text-2xl font-extrabold">Start your services</h2>
      <p className="mt-1 text-ink-soft">Pay the first month{order.quote.setupTotal ? " and setup" : ""} now. Set up UPI AutoPay so future bills never bounce — you can cancel it any time from your UPI app.</p>
      <div className="mt-4 flex items-baseline justify-between rounded-xl border border-rule bg-sheet p-4">
        <span>Due today</span>
        <span className="text-3xl font-extrabold tabular-nums">{inr(due)}</span>
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          onUpdate(await act(order.id, { action: "pay", method: "upi_autopay" }));
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-marigold px-4 py-3.5 text-lg font-extrabold text-ink disabled:opacity-60"
      >
        <IndianRupee size={20} /> {busy ? "Confirming…" : "Pay with UPI AutoPay"}
      </button>
      <p className="mt-2 text-center text-sm text-ink-soft">Demo payment — no money moves.</p>
    </section>
  );
}

export { act };
