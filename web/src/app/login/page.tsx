"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { PageShell } from "@/components/SiteNav";
import { WhatsAppLogo } from "@/components/BrandIcons";

type Step = "phone" | "call" | "whatsapp";

const planSession = () => {
  try {
    return JSON.parse(localStorage.getItem("accel:plan") ?? "null")?.id as string | undefined;
  } catch {
    return undefined;
  }
};

/** Sign in: a call reads out a code, or WhatsApp sends one, or try the demo. */
function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/account";
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [waLink, setWaLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    fetch("/api/auth/whatsapp")
      .then((r) => r.json())
      .then((j) => setWaLink(j.link))
      .catch(() => {});
  }, []);

  const go = (s: Step) => {
    setStep(s);
    setCode("");
    setError("");
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error ?? "Something went wrong. Try again.");
      return r.ok ? j : undefined;
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function call() {
    const j = await post("/api/auth/otp", { phone, via: "call" });
    if (!j) return;
    setRequestId(j.requestId);
    setSentTo(j.sentTo);
    setWait(30);
    go("call");
  }

  async function verify(value = code) {
    if (value.length < 4) return;
    const language = document.documentElement.lang || undefined;
    const j = step === "whatsapp" ? await post("/api/auth/whatsapp", { code: value, sessionId: planSession(), language }) : await post("/api/auth/verify", { requestId, code: value, sessionId: planSession(), language });
    if (!j) return setCode("");
    router.replace(next);
    router.refresh();
  }

  async function demo() {
    if (await post("/api/auth/demo", { sessionId: planSession() })) {
      router.replace(next);
      router.refresh();
    }
  }

  const field = "w-full rounded-2xl border border-rule bg-sheet px-4 py-4 text-lg outline-none transition-colors focus:border-ink";
  const primary = "flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-4 text-lg font-extrabold text-white transition-opacity disabled:opacity-40";

  return (
    <div className="mx-auto grid max-w-sm gap-5 pt-10 pb-20">
      <h1 className="text-3xl font-extrabold tracking-tight">{step === "phone" ? "Sign in" : "Enter the code"}</h1>

      {step === "phone" ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void call();
          }}
        >
          <label className="relative block">
            <span className="sr-only">Mobile number</span>
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-ink-soft">+91</span>
            <input autoFocus required inputMode="numeric" autoComplete="tel-national" maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} placeholder="Mobile number" className={`${field} pl-14`} />
          </label>
          <button disabled={busy || phone.replace(/\D/g, "").length < 10} className={primary}>
            {busy && <Loader2 size={18} className="animate-spin" />} Send code
          </button>
          <p className="text-center text-sm text-ink-soft">You&apos;ll get a call with the code.</p>
        </form>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <p className="-mt-2 text-ink-soft">{step === "call" ? `Calling ${sentTo}. Pick up and listen for the code.` : "Send LOGIN to us on WhatsApp. We'll reply with your code."}</p>
          <input
            ref={codeRef}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            aria-label="Code"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setCode(v);
              if (v.length === 6) void verify(v);
            }}
            className={`${field} text-center font-mono text-3xl tracking-[0.5em]`}
          />
          <button disabled={busy || code.length < 4} className={primary}>
            {busy && <Loader2 size={18} className="animate-spin" />} Sign in
          </button>
          <div className="flex items-center justify-between text-sm font-semibold">
            <button type="button" className="text-ink-soft hover:text-ink" onClick={() => setStep("phone")}>Back</button>
            {step === "call" ? (
              <button type="button" disabled={wait > 0 || busy} className="text-brand disabled:text-ink-soft" onClick={() => void call()}>
                {wait > 0 ? `Call again in ${wait}s` : "Call again"}
              </button>
            ) : (
              waLink && <a href={waLink} target="_blank" rel="noreferrer" className="text-wa">Open WhatsApp</a>
            )}
          </div>
        </form>
      )}

      {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}

      {step === "phone" && (
        <>
          <div className="flex items-center gap-3 text-sm text-ink-soft"><span className="h-px flex-1 bg-rule" /> or <span className="h-px flex-1 bg-rule" /></div>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" onClick={() => go("whatsapp")} className="flex items-center justify-center gap-2.5 rounded-full border border-rule bg-sheet px-4 py-3.5 text-lg font-bold hover:bg-paper">
              <WhatsAppLogo className="h-6 w-6" /> Get the code on WhatsApp
            </a>
          )}
          <button type="button" disabled={busy} onClick={() => void demo()} className="flex items-center justify-center gap-2.5 rounded-full border border-rule bg-sheet px-4 py-3.5 text-lg font-bold hover:bg-paper disabled:opacity-50">
            <PlayCircle size={22} className="text-brand" /> Continue with demo
          </button>
        </>
      )}
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
