"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { send, useApi } from "@/lib/api";
import type { Report } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { Empty, Loading, PageHead } from "@/components/ui";
import { ReportCard } from "@/components/ReportCard";

/** Supervisor: write and send the day's report (drafted from what happened). Manager: read them. */
export default function Reports() {
  const me = useMe();
  const { data, reload } = useApi<{ reports: Report[]; draft: string | null }>("/api/staff/reports", 30_000);
  const [text, setText] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Start from the draft once; don't overwrite what the supervisor is typing when the page refreshes.
  useEffect(() => {
    if (text === undefined && data?.draft) setText(data.draft);
  }, [data?.draft, text]);
  if (!data) return <><PageHead title="Reports" /><Loading /></>;

  async function submit() {
    setBusy(true);
    const r = await send("/api/staff/reports", "POST", { text });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setMsg("Sent to the manager");
    setText(undefined);
    await reload();
  }

  return (
    <>
      <PageHead title="Reports" sub={me.role === "supervisor" ? "Your end-of-day report to the manager. We've drafted it from today's calls, orders and updates; change anything before you send." : "End-of-day reports from your supervisor."} />
      {me.role === "supervisor" && (
        <section className="card mb-6 p-5">
          <h2 className="font-extrabold">Today&apos;s report</h2>
          <textarea value={text ?? ""} onChange={(e) => setText(e.target.value)} rows={8} className="mt-3 w-full rounded-xl border border-rule bg-paper p-3 text-[15px] leading-relaxed outline-none focus:border-ink" />
          <div className="mt-3 flex items-center gap-3">
            <button disabled={busy || (text ?? "").trim().length < 10} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-extrabold text-white disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send to manager
            </button>
            {msg && <span role="status" className="text-sm font-semibold text-ink-soft">{msg}</span>}
          </div>
        </section>
      )}
      {data.reports.length ? <div className="grid gap-3">{data.reports.map((r) => <ReportCard key={r.id} r={r} />)}</div> : <Empty>No reports yet.</Empty>}
    </>
  );
}
