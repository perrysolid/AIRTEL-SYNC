"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, FileCheck2, Landmark, Loader2, XCircle } from "lucide-react";
import type { PublicOrder } from "@/lib/order-view";
import { DOC_LABELS, DOC_TYPES, type DocType, type ExtractedDoc, type KycCheck } from "@/lib/kyc-types";

type Slot = { status: "empty" | "reading" | "read" | "error"; doc?: ExtractedDoc; engine?: string; ms?: number; preview?: string; error?: string };

const KEY_FIELDS: Record<DocType, (keyof ExtractedDoc["fields"])[]> = {
  gst_certificate: ["gstin", "legalName", "constitution"],
  udyam_certificate: ["udyamNumber", "enterpriseName", "city"],
  address_proof: ["billedTo", "billDate", "address"],
  signatory_id: ["signatoryName", "designation", "validTill"],
};

const FIELD_LABEL: Partial<Record<keyof ExtractedDoc["fields"], string>> = {
  gstin: "GSTIN", legalName: "Legal name", constitution: "Type", udyamNumber: "Udyam no.", enterpriseName: "Name", city: "City",
  billedTo: "Billed to", billDate: "Bill date", address: "Address", signatoryName: "Name", designation: "Role", validTill: "Valid till",
};

const SAMPLES = ["K01", "K02", "K03", "K04", "K05", "K06", "K07", "K08", "K09", "K10", "K11", "K12"];

export function KycStep({ order, onUpdate }: { order: PublicOrder; onUpdate: (o: PublicOrder) => void }) {
  const [slots, setSlots] = useState<Record<DocType, Slot>>(() => Object.fromEntries(DOC_TYPES.map((t) => [t, { status: "empty" }])) as Record<DocType, Slot>);
  const [gstin, setGstin] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const result = order.kyc?.checks?.length ? order.kyc : undefined;

  const upload = async (t: DocType, file: Blob, name = "doc.png") => {
    const preview = URL.createObjectURL(file);
    setSlots((s) => ({ ...s, [t]: { status: "reading", preview } }));
    const fd = new FormData();
    fd.set("orderId", order.id);
    fd.set("docType", t);
    fd.set("file", new File([file], name, { type: file.type || "image/png" }));
    const r = await fetch("/api/kyc/extract", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) return setSlots((s) => ({ ...s, [t]: { status: "error", preview, error: j.error } }));
    const slotType = (DOC_TYPES as readonly string[]).includes(j.docType) ? (j.docType as DocType) : t;
    setSlots((s) => ({ ...s, [slotType]: { status: "read", doc: j.doc, engine: j.engine, ms: j.ms, preview } }));
  };

  const loadSample = async (k: string) => {
    setBusy(`Loading sample ${k}…`);
    setSlots(Object.fromEntries(DOC_TYPES.map((t) => [t, { status: "empty" }])) as Record<DocType, Slot>);
    await Promise.all(
      DOC_TYPES.map(async (t) => {
        const r = await fetch(`/kyc/${k}_${t}.png`);
        if (r.ok) await upload(t, await r.blob(), `${k}_${t}.png`);
      }),
    );
    setBusy("");
  };

  const digilocker = async () => {
    setError("");
    setBusy("Connecting to DigiLocker…");
    const r = await fetch("/api/kyc/digilocker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, gstin }) });
    const j = await r.json();
    setBusy("");
    if (!r.ok) return setError(j.error);
    setSlots((s) => {
      const next = { ...s };
      for (const [t, doc] of Object.entries(j.docs as Record<DocType, ExtractedDoc>)) next[t as DocType] = { status: "read", doc, engine: "DigiLocker" };
      return next;
    });
  };

  const verify = async () => {
    setBusy("Checking against GST and Udyam registries…");
    setError("");
    const docs = Object.fromEntries(Object.entries(slots).filter(([, s]) => s.doc).map(([t, s]) => [t, s.doc]));
    const r = await fetch("/api/kyc/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, docs }) });
    const j = await r.json();
    setBusy("");
    if (!r.ok) return setError(j.error);
    onUpdate(j);
  };

  const readCount = Object.values(slots).filter((s) => s.status === "read").length;

  return (
    <section>
      <h2 className="text-2xl font-extrabold">Verify your business</h2>
      <p className="mt-1 text-ink-soft">Fastest: fetch from DigiLocker. Or take photos of your documents — we read them for you.</p>

      {result && <KycResult kyc={result} />}

      <div className="mt-4 rounded-xl border border-rule bg-sheet p-4">
        <div className="flex items-center gap-2 font-bold"><Landmark size={18} /> Fetch from DigiLocker</div>
        <p className="mt-1 text-sm text-ink-soft">Your GST and Udyam records come straight from the government — nothing to photograph, nothing to mistype.</p>
        <div className="mt-3 flex gap-2">
          <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="Your 15-character GSTIN" className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 py-2.5 font-mono uppercase placeholder:font-sans placeholder:normal-case" aria-label="GSTIN" />
          <button onClick={digilocker} disabled={gstin.length < 15 || !!busy} className="rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-40">Fetch</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {DOC_TYPES.map((t) => (
          <DocSlot key={t} type={t} slot={slots[t]} onFile={(f) => void upload(t, f, f instanceof File ? f.name : undefined)} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <label className="text-ink-soft" htmlFor="sample">Demo: load a specimen applicant</label>
        <select id="sample" defaultValue="" onChange={(e) => e.target.value && void loadSample(e.target.value)} className="rounded-lg border border-rule bg-sheet px-2 py-1.5">
          <option value="" disabled>Choose…</option>
          {SAMPLES.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="mt-3 font-medium text-bad">{error}</p>}
      {busy && <p className="mt-3 flex items-center gap-2 text-ink-soft"><Loader2 size={16} className="animate-spin" /> {busy}</p>}

      <button onClick={verify} disabled={readCount === 0 || !!busy || Object.values(slots).some((s) => s.status === "reading")} className="mt-4 w-full rounded-xl bg-brand px-4 py-3.5 text-lg font-extrabold text-white disabled:opacity-50">
        Verify {readCount > 0 ? `${readCount} document${readCount > 1 ? "s" : ""}` : "documents"}
      </button>
    </section>
  );
}

function DocSlot({ type, slot, onFile }: { type: DocType; slot: Slot; onFile: (f: File) => void }) {
  return (
    <div className={`flex flex-col rounded-xl border bg-sheet p-3 ${slot.status === "read" && slot.doc && !slot.doc.legible ? "border-bad" : "border-rule"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm leading-tight font-bold">{DOC_LABELS[type]}{type === "udyam_certificate" && <span className="font-normal text-ink-soft"> (optional)</span>}</div>
        {slot.status === "read" && slot.doc?.legible && <CheckCircle2 size={18} className="shrink-0 text-ok" />}
        {slot.status === "read" && slot.doc && !slot.doc.legible && <XCircle size={18} className="shrink-0 text-bad" />}
      </div>
      {slot.preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot.preview} alt="" className="mt-2 h-20 w-full rounded-md border border-rule object-cover object-top" />
      )}
      {slot.status === "reading" && <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft"><Loader2 size={14} className="animate-spin" /> Reading…</div>}
      {slot.status === "error" && <div className="mt-2 text-sm text-bad">{slot.error}</div>}
      {slot.status === "read" && slot.doc && (
        <dl className="mt-2 space-y-0.5 text-[12.5px] leading-snug">
          {!slot.doc.legible && <div className="font-medium text-bad">Couldn&apos;t read clearly ({slot.doc.qualityIssues.join(", ")}). Please retake.</div>}
          {slot.doc.legible &&
            KEY_FIELDS[type].map((f) => (
              <div key={f} className="flex gap-1">
                <dt className="shrink-0 text-ink-soft">{FIELD_LABEL[f]}:</dt>
                <dd className="truncate font-medium">{slot.doc!.fields[f] ?? <span className="text-bad">missing</span>}</dd>
              </div>
            ))}
          <div className="pt-1 text-[11px] text-ink-soft">via {slot.engine}{slot.ms ? ` · ${(slot.ms / 1000).toFixed(1)}s` : ""}{slot.doc.qualityIssues.includes("rotated") ? " · auto-straightened" : ""}</div>
        </dl>
      )}
      <label className="mt-auto inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rule px-2 py-1.5 pt-1.5 text-sm font-medium hover:border-ink-soft [&:not(:first-child)]:mt-2">
        <Camera size={15} /> {slot.status === "empty" ? "Take photo" : "Retake"}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
    </div>
  );
}

const STAMP = {
  verified: { text: "VERIFIED", cls: "text-ok", sub: "" },
  needs_attention: { text: "FIX NEEDED", cls: "text-warn", sub: "" },
  rejected: { text: "UNDER REVIEW", cls: "text-bad", sub: "" },
};

function KycResult({ kyc }: { kyc: NonNullable<PublicOrder["kyc"]> }) {
  const s = STAMP[kyc.verdict];
  const by = (st: KycCheck["status"]) => kyc.checks.filter((c) => c.status === st);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [kyc.at]);
  return (
    <div ref={ref} className="mt-4 scroll-mt-20 rounded-xl border border-rule bg-sheet p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{kyc.summary}</p>
        <span key={kyc.at} className={`stamp stamp-in shrink-0 ${s.cls}`}>{s.text}</span>
      </div>
      {kyc.actions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {kyc.actions.map((a) => (
            <li key={a} className="flex gap-2 text-[15px]"><AlertTriangle size={16} className="mt-1 shrink-0 text-warn" /> {a}</li>
          ))}
        </ul>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-ink-soft">All {kyc.checks.length} checks</summary>
        <ul className="mt-2 space-y-1.5">
          {[...by("fail"), ...by("warn"), ...by("pass")].map((c) => (
            <li key={c.id} className="flex gap-2">
              {c.status === "pass" ? <FileCheck2 size={15} className="mt-0.5 shrink-0 text-ok" /> : c.status === "warn" ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" /> : <XCircle size={15} className="mt-0.5 shrink-0 text-bad" />}
              <span><span className="font-semibold">{c.title}.</span> <span className="text-ink-soft">{c.detail}</span></span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
