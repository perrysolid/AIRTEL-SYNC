"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MessageCircle, PhoneCall, PlayCircle, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/SiteNav";

/** Sign in with a mobile number and a one-time SMS code. No password, no form beyond the number. */
function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/account";
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [via, setVia] = useState<"sms" | "call">("sms");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const planSession = () => {
    try {
      return JSON.parse(localStorage.getItem("accel:plan") ?? "null")?.id as string | undefined;
    } catch {
      return undefined;
    }
  };

  async function send(how: "sms" | "call" = "sms") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, via: how }) });
      const j = await r.json();
      if (!r.ok) return setError(j.error ?? "Couldn't send the code.");
      setRequestId(j.requestId);
      setSentTo(j.sentTo);
      setVia(how);
      setStep("code");
      setCode("");
      setWait(30);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length < 4) return;
    setBusy(true);
    setError("");
    const sessionId = planSession();
    try {
      const r = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, code: value, sessionId, language: document.documentElement.lang || undefined }) });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "That code didn't work.");
        setCode("");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: planSession() }) });
      if (!r.ok) return setError("Couldn't open the demo. Try again.");
      router.replace(next);
      router.refresh();
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1.5 w-full rounded-xl border border-rule bg-sheet px-4 py-3.5 text-lg outline-none focus:border-brand";
  return (
    <div className="mx-auto grid max-w-md gap-6 pt-6 pb-16">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{step === "phone" ? "Sign in with your mobile" : "Enter the code"}</h1>
        <p className="mt-2 text-ink-soft">
          {step === "phone" ? "We'll text you a code. Your plan, your orders and every update stay with you, here and on WhatsApp." : via === "call" ? `We're calling ${sentTo} now. Pick up and listen for the code.` : `We sent a code to ${sentTo}.`}
        </p>
      </div>

      <form
        className="card grid gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void (step === "phone" ? send("sms") : verify());
        }}
      >
        {step === "phone" ? (
          <label>
            <span className="text-sm font-semibold">Mobile number</span>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 mt-[3px] -translate-y-1/2 text-lg text-ink-soft">+91</span>
              <input autoFocus required inputMode="numeric" autoComplete="tel-national" maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} placeholder="98765 43210" className={`${field} pl-14`} />
            </div>
          </label>
        ) : (
          <label>
            <span className="text-sm font-semibold">6-digit code</span>
            <input
              ref={codeRef}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setCode(v);
                if (v.length === 6) void verify(v); // phones that fill the code from the SMS sign in straight away
              }}
              className={`${field} text-center font-mono text-2xl tracking-[0.5em]`}
            />
          </label>
        )}
        {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}
        <button disabled={busy || (step === "phone" ? phone.replace(/\D/g, "").length < 10 : code.length < 4)} className="btn-primary flex items-center justify-center gap-2 px-4 py-3.5 text-lg disabled:opacity-50">
          {busy && <Loader2 size={18} className="animate-spin" />} {step === "phone" ? "Send code" : "Sign in"}
        </button>
        {step === "phone" && (
          <button type="button" disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={() => void send("call")} className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-50">
            <PhoneCall size={16} /> Call me with the code instead
          </button>
        )}
        {step === "code" && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" className="font-semibold text-ink-soft hover:text-ink" onClick={() => setStep("phone")}>Change number</button>
            {wait > 0 ? (
              <span className="text-ink-soft">Resend in {wait}s</span>
            ) : (
              <span className="flex gap-4">
                <button type="button" disabled={busy} className="font-semibold text-brand" onClick={() => void send("sms")}>Text it again</button>
                <button type="button" disabled={busy} className="inline-flex items-center gap-1 font-semibold text-brand" onClick={() => void send("call")}><PhoneCall size={14} /> Call me</button>
              </span>
            )}
          </div>
        )}
      </form>

      <div className="flex items-center gap-3 text-sm text-ink-soft"><span className="h-px flex-1 bg-rule" /> or <span className="h-px flex-1 bg-rule" /></div>
      <button type="button" disabled={busy} onClick={() => void demo()} className="inline-flex items-center justify-center gap-2 rounded-full border border-rule bg-sheet px-4 py-3.5 text-lg font-bold hover:bg-paper disabled:opacity-50">
        <PlayCircle size={20} className="text-brand" /> Continue with demo
      </button>
      <p className="-mt-3 text-center text-sm text-ink-soft">No number needed. Opens a sample account for Ramesh&apos;s kirana store in Indore.</p>

      <ul className="grid gap-2 text-sm text-ink-soft">
        <li className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-ok" /> No password. Your number is only used to sign you in and send your order updates.</li>
        <li className="flex gap-2"><MessageCircle size={18} className="shrink-0 text-wa" /> Updates arrive on WhatsApp the moment anything changes. Switch them off any time.</li>
      </ul>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PageShell>
      <Suspense>
        <Login />
      </Suspense>
    </PageShell>
  );
}
