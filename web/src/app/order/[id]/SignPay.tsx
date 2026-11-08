"use client";

import { useState } from "react";
import { FileSignature, IndianRupee, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CountUp } from "@/components/motion/CountUp";
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
      <h2 className="text-3xl font-extrabold">Sign your agreement</h2>
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
        <button onClick={() => setOtpSent(true)} className="mt-4 flex w-full items-center justify-center gap-2 btn-primary px-4 py-3.5 text-lg">
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
  const [phase, setPhase] = useState<"idle" | "paying" | "paid">("idle");
  const [error, setError] = useState("");
  const reduce = useReducedMotion();
  const due = order.quote.monthlyWithGst + order.quote.setupTotal;
  const pay = async () => {
    setPhase("paying");
    setError("");
    try {
      const next = await act(order.id, { action: "pay", method: "upi_autopay" });
      setPhase("paid");
      // Let the success moment land before the tracker takes over.
      setTimeout(() => onUpdate(next), reduce ? 0 : 2200);
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  return (
    <section>
      <h2 className="text-3xl font-extrabold">Start your services</h2>
      <p className="mt-2 text-ink-soft">Pay the first month{order.quote.setupTotal ? " and setup" : ""} now. Set up UPI AutoPay so future bills never bounce — you can cancel it any time from your UPI app.</p>

      <div className="night relative mt-5 overflow-hidden rounded-[24px] p-6">
        <AnimatePresence mode="wait">
          {phase !== "paid" ? (
            <motion.div key="due" exit={{ opacity: 0, scale: 0.96 }}>
              <div className="text-white/70">Due today</div>
              <div className="mt-1 text-5xl font-extrabold"><CountUp value={due} duration={1.2} /></div>
              <ul className="mt-4 space-y-1 text-sm text-white/70">
                <li className="flex justify-between"><span>First month incl. GST</span><span className="tabular-nums">{inr(order.quote.monthlyWithGst)}</span></li>
                {order.quote.setupTotal > 0 && <li className="flex justify-between"><span>One-time setup</span><span className="tabular-nums">{inr(order.quote.setupTotal)}</span></li>}
                <li className="flex justify-between"><span>Then every month</span><span className="tabular-nums">{inr(order.quote.monthlyWithGst)}</span></li>
              </ul>
              {phase === "paying" && (
                <div className="mt-5 flex items-center gap-3 text-white/85">
                  <Loader2 className="animate-spin" size={18} /> Waiting for approval in your UPI app…
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="paid" className="py-2 text-center" initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="relative mx-auto grid h-24 w-24 place-items-center">
                {!reduce && [0, 1].map((k) => (
                  <motion.span key={k} className="absolute inset-0 rounded-full bg-signal/30" initial={{ scale: 0.5, opacity: 0.9 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ delay: 0.15 + k * 0.35, duration: 1.2 }} />
                ))}
                <motion.span className="grid h-20 w-20 place-items-center rounded-full bg-signal" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 14 }}>
                  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <motion.path d="M5 12.5 10 17 19 7" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.4 }} />
                  </svg>
                </motion.span>
                {!reduce && Array.from({ length: 14 }, (_, k) => {
                  const a = (k / 14) * Math.PI * 2;
                  return (
                    <motion.span key={k} className="absolute h-2 w-2 rounded-full" style={{ background: ["#ffb400", "#e4002b", "#00a87e", "#ffffff"][k % 4] }} initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90, opacity: 0 }} transition={{ delay: 0.25, duration: 0.9, ease: "easeOut" }} />
                  );
                })}
              </div>
              <div className="mt-4 text-2xl font-extrabold">{inr(due)} received</div>
              <div className="mt-1 text-white/70">AutoPay is on. Switching on your services…</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase !== "paid" && (
        <button disabled={phase === "paying"} onClick={pay} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-lg">
          <IndianRupee size={20} /> {phase === "paying" ? "Confirming…" : `Pay ${inr(due)} with UPI AutoPay`}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-bad">{error}</p>}
      <p className="mt-2 text-center text-sm text-ink-soft">Demo payment — no money moves.</p>
    </section>
  );
}

export { act };
