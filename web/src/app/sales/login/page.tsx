"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { Loader2, LockKeyhole } from "lucide-react";
import { signIn } from "../actions";

const BARS = [0.31, 0.24, 0.17, 0.12, 0.09, 0.06, 0.04];

export default function SalesLogin() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <aside className="night relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="grid-floor absolute inset-0" />
        <div className="relative flex items-center gap-2.5 text-xl font-bold">
          <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden>
            <rect width="64" height="64" rx="16" fill="#e4002b" />
            <path d="M18 46 32 16l14 30h-8l-6-14-6 14z" fill="#fff" />
          </svg>
          Accel Business <span className="font-medium text-white/60">Sales</span>
        </div>
        <div className="relative">
          <h1 className="max-w-lg text-5xl font-extrabold">Call the shops most likely to say yes</h1>
          <p className="mt-4 max-w-md text-lg text-white/70">Every lead scored by the activation model, every call on record, and the follow-ups that are due today at the top.</p>
          <div className="mt-10 flex h-40 max-w-md items-end gap-3">
            {BARS.map((b, i) => (
              <motion.div key={i} className="flex-1 origin-bottom rounded-t-md" style={{ height: `${Math.round((b / 0.31) * 100)}%`, background: i < 3 ? "var(--brand)" : "rgb(255 255 255 / 0.18)" }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} />
            ))}
          </div>
          <div className="mt-2 max-w-md text-sm text-white/50">Chance to activate, best leads first</div>
        </div>
        <p className="relative text-sm text-white/50">For Accel sales staff and authorised channel partners. Activity is logged.</p>
      </aside>

      <main className="grid place-items-center px-4 py-16">
        <form action={action} className="w-full max-w-sm">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><LockKeyhole size={22} /></span>
          <h2 className="mt-5 text-3xl font-extrabold">Sign in to the sales portal</h2>
          <p className="mt-2 text-ink-soft">Use your Accel staff or partner email.</p>
          <label className="mt-8 block">
            <span className="text-sm font-semibold">Work email</span>
            <input name="email" type="email" required autoComplete="username" className="mt-1.5 w-full rounded-xl border border-rule bg-sheet px-4 py-3 outline-none focus:border-brand" />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className="mt-1.5 w-full rounded-xl border border-rule bg-sheet px-4 py-3 outline-none focus:border-brand" />
          </label>
          {state?.error && <p role="alert" className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{state.error}</p>}
          <button disabled={pending} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-lg">
            {pending && <Loader2 size={18} className="animate-spin" />} Sign in
          </button>
          <p className="mt-6 text-sm text-ink-soft">Demo accounts are listed in the project README.</p>
        </form>
      </main>
    </div>
  );
}
