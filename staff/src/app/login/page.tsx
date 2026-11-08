"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { send } from "@/lib/api";
import { Mark } from "@/components/ui";

// Demo accounts on the backend (synthetic data). The password is the demo one unless STAFF_DEMO_PASSWORD is set there.
const DEMO = [
  { label: "Manager", email: "manager@accel.demo" },
  { label: "Field sales, North", email: "priya@accel.demo" },
  { label: "Channel partner", email: "metro@partner.demo" },
];
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_STAFF_DEMO_PASSWORD ?? "Accel@2026";

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e = email, p = password) {
    setBusy(true);
    setError("");
    const r = await send("/api/staff/session", "POST", { email: e, password: p });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.replace(next?.startsWith("/") ? next : "/");
  }

  const field = "w-full rounded-2xl border border-rule bg-sheet px-4 py-3.5 text-lg outline-none focus:border-ink";
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <Mark className="h-10 w-10" />
          <span className="text-xl font-extrabold"><span className="text-brand">accel</span> <span className="font-medium text-ink-soft">business</span></span>
        </div>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">Staff sign in</h1>
        <p className="mt-1 text-ink-soft">For Accel sales teams and channel partners.</p>
        <form
          className="mt-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void signIn();
          }}
        >
          <input required type="email" autoComplete="username" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          <input required type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          {error && <p role="alert" className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand-deep">{error}</p>}
          <button disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-lg font-extrabold text-white disabled:opacity-50">
            {busy && <Loader2 size={18} className="animate-spin" />} Sign in
          </button>
        </form>
        <div className="mt-8">
          <div className="text-sm font-semibold text-ink-soft">Try a demo account</div>
          <div className="mt-2 grid gap-2">
            {DEMO.map((d) => (
              <button key={d.email} disabled={busy} onClick={() => void signIn(d.email, DEMO_PASSWORD)} className="flex items-center justify-between rounded-2xl border border-rule bg-sheet px-4 py-3 text-left hover:border-ink/25 disabled:opacity-50">
                <span className="font-bold">{d.label}</span>
                <span className="text-sm text-ink-soft">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
