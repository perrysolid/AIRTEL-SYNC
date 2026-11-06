"use client";

import { useState } from "react";
import { TopBar } from "@/components/Brand";

const PRINCIPLES = [
  ["We ask before we read", "Documents are only read after you agree to each purpose. Optional uses (partner help, offers) are off unless you switch them on."],
  ["We keep the least we can", "Your photos are read in memory and thrown away. We keep the few details needed to activate your services and a fingerprint (hash) of each file as proof."],
  ["Only for what you agreed", "KYC details are used for verification and activation only. Partners never see your documents — only your enquiry, if you allow it."],
  ["Masked everywhere", "GSTIN, Udyam, phone and ID numbers are masked on screens and in our logs."],
  ["You stay in control", "Download your data, withdraw optional consent, or ask us to erase it — right here, any time."],
];

export default function PrivacyPage() {
  const [form, setForm] = useState({ orderId: "", phoneLast4: "", action: "export", purpose: "offers" });
  const [out, setOut] = useState<string>();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    setOut(r.ok ? JSON.stringify(j, null, 2) : j.error);
  };
  return (
    <div className="min-h-dvh pb-16">
      <TopBar />
      <main className="mx-auto max-w-xl px-4">
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Your data, in plain words</h1>
        <ul className="mt-5 space-y-4">
          {PRINCIPLES.map(([t, d]) => (
            <li key={t}>
              <h2 className="font-bold">{t}</h2>
              <p className="text-ink-soft">{d}</p>
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="mt-10 rounded-xl border border-rule bg-sheet p-4">
          <h2 className="text-xl font-extrabold">Manage your data</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 block"><span className="text-sm font-semibold">Order ID</span><input required value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 uppercase" /></label>
            <label className="block"><span className="text-sm font-semibold">Last 4 digits of mobile</span><input required inputMode="numeric" maxLength={4} value={form.phoneLast4} onChange={(e) => setForm({ ...form, phoneLast4: e.target.value.replace(/\D/g, "") })} className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2" /></label>
            <label className="block"><span className="text-sm font-semibold">I want to</span>
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2">
                <option value="export">Download my data</option>
                <option value="withdraw">Withdraw a consent</option>
                <option value="erase">Erase my data</option>
              </select>
            </label>
            {form.action === "withdraw" && (
              <label className="col-span-2 block"><span className="text-sm font-semibold">Which consent</span>
                <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2">
                  <option value="offers">Offers</option>
                  <option value="partner_assist">Partner help</option>
                  <option value="service_activation">Service activation</option>
                  <option value="kyc_verification">KYC verification</option>
                </select>
              </label>
            )}
          </div>
          <button className="mt-4 w-full rounded-xl bg-ink px-4 py-3 font-bold text-paper">Continue</button>
          {out && <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-paper p-3 text-xs whitespace-pre-wrap">{out}</pre>}
        </form>
      </main>
    </div>
  );
}
