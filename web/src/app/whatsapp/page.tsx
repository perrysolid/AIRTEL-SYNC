"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { Rich } from "@/components/Rich";

/**
 * WhatsApp channel simulator: posts to the same /api/whatsapp webhook Twilio
 * calls in production, so what you see here is exactly what the bot sends.
 */
export default function WhatsAppSim() {
  const [msgs, setMsgs] = useState<{ me: boolean; text: string; at: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const from = useRef("whatsapp:+9198" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const send = async (text: string, show = true) => {
    const at = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    if (show) setMsgs((m) => [...m, { me: true, text, at }]);
    setBusy(true);
    const r = await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: from.current, Body: text }) });
    const xml = await r.text();
    const body = new DOMParser().parseFromString(xml, "text/xml").querySelector("Message")?.textContent ?? "";
    setMsgs((m) => [...m, { me: false, text: body, at }]);
    setBusy(false);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send("Hi", true);
  }, []);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  return (
    <div className="grid min-h-dvh place-items-center bg-paper p-0 sm:p-6">
      <div className="flex h-dvh w-full max-w-md flex-col overflow-hidden bg-[#efeae2] sm:h-[780px] sm:rounded-[2rem] sm:border-8 sm:border-ink dark:bg-[#0b141a]">
        <header className="flex items-center gap-3 bg-wa px-3 py-2.5 text-white">
          <Link href="/" aria-label="Back"><ArrowLeft size={20} /></Link>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 font-bold">A</div>
          <div>
            <div className="font-semibold leading-tight">Accel Business</div>
            <div className="text-xs opacity-80">{busy ? "typing…" : "Verified business · replies instantly"}</div>
          </div>
        </header>
        <div ref={ref} className="flex-1 space-y-2 overflow-y-auto p-3">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-lg px-3 py-1.5 text-[15px] shadow-sm ${m.me ? "ml-auto rounded-tr-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-white" : "rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-white"}`}>
              <div className="whitespace-pre-wrap"><Rich text={m.text} /></div>
              <div className="text-right text-[10px] opacity-60">{m.at}</div>
            </div>
          ))}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-2 pt-1" aria-label="Quick commands">
          {["STATUS", "SHIELD", "NETWORK 411016 Pune", "SCHEDULE", "TROUBLE", "BRANCH", "BACKUP", "HELP"].map((c) => (
            <button key={c} disabled={busy} onClick={() => void send(c)} className="shrink-0 rounded-full border border-[#cfe9e3] bg-white px-3 py-1 text-xs font-bold text-[#0b6b5d] shadow-sm disabled:opacity-50">{c}</button>
          ))}
        </div>
        <form
          className="flex gap-2 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || busy) return;
            void send(input.trim());
            setInput("");
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message" className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-[#111b21] dark:bg-[#2a3942] dark:text-white" aria-label="Message" />
          <button className="grid h-11 w-11 place-items-center rounded-full bg-wa text-white" aria-label="Send"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}
