"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Check, Headphones, Keyboard, Loader2, Mic, Send, Square, UserRound } from "lucide-react";
import { TopBar } from "@/components/Brand";
import { Bill } from "@/components/Bill";
import { Shop3D, VISUAL_LABEL } from "@/components/shop/Shop3D";
import { useMedia } from "@/components/useMedia";
import { Rich } from "@/components/Rich";
import { useVoice } from "@/components/useVoice";
import { LANGUAGES, type AdvisorEvent, type Chip } from "@/lib/advisor-types";
import type { Profile } from "@/lib/profile";
import type { Quote } from "@/lib/pricing";
import type { Recommendation } from "@/lib/recommend";

type Msg =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string; chips?: { mode: "single" | "multi"; options: Chip[] } }
  | { kind: "bundle"; quote: Quote; recommendation: Recommendation }
  | { kind: "handoff"; reason: string };

const SEGMENT_NAMES: Record<string, string> = { micro: "Retail & services", prof: "Professional office", multi: "Multi-site", mfg: "Manufacturer" };

function profileFacts(p?: Profile): string[] {
  if (!p) return [];
  return [
    p.businessName ?? p.businessType,
    p.segment && SEGMENT_NAMES[p.segment],
    p.city,
    p.employees && `${p.employees} people`,
    p.sites && p.sites > 1 && `${p.sites} locations`,
    p.hasGstin === false ? "No GST" : p.gstinActive === false ? "GST inactive" : p.hasGstin ? "GST ✓" : undefined,
    ...p.needs.slice(0, 4).map((n) => n.replace(/_/g, " ")),
  ].filter(Boolean) as string[];
}

async function* sse(res: Response, onData: () => void): AsyncGenerator<AdvisorEvent> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onData();
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (chunk.startsWith("data: ")) yield JSON.parse(chunk.slice(6)) as AdvisorEvent;
    }
  }
}

function Advisor() {
  const params = useSearchParams();
  const [lang, setLang] = useState(params.get("lang") ?? "en");
  const [voiceMode, setVoiceMode] = useState(params.get("voice") === "1");
  const bcp47 = LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? "en-IN";
  const voice = useVoice(bcp47);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"ai" | "guided" | undefined>();
  const [profile, setProfile] = useState<Profile>();
  const [multi, setMulti] = useState<string[]>([]);
  const sessionRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const voiceRef = useRef(voiceMode);
  voiceRef.current = voiceMode;
  // Hands-free turn-taking: after the advisor speaks, listen again automatically.
  const autoListenRef = useRef(true);
  const sendRef = useRef<((m: string) => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, status]);

  const send = useCallback(
    async (message: string, display?: string) => {
      if (busy) return;
      setBusy(true);
      setMulti([]);
      if (message) setMsgs((m) => [...m.map((x) => (x.kind === "bot" ? { ...x, chips: undefined } : x)), { kind: "user", text: display ?? message }]);
      let spoken = "";
      let botIndex = -1;
      // A connection that goes silent (a dropped proxy hop, a server restart) is
      // abandoned after 45 s instead of leaving the chat stuck on "busy".
      const ctrl = new AbortController();
      let watchdog = setTimeout(() => ctrl.abort(), 45_000);
      const alive = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => ctrl.abort(), 45_000);
      };
      try {
        const res = await fetch("/api/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionRef.current, message, language: lang, channel: voiceRef.current ? "voice" : "web" }),
          signal: ctrl.signal,
        });
        for await (const e of sse(res, alive)) {
          switch (e.type) {
            case "session":
              sessionRef.current = e.sessionId;
              setMode(e.mode);
              break;
            case "text":
              spoken += e.delta;
              setStatus("");
              setMsgs((m) => {
                const copy = [...m];
                if (botIndex >= 0 && copy[botIndex]?.kind === "bot") {
                  const b = copy[botIndex] as Extract<Msg, { kind: "bot" }>;
                  copy[botIndex] = { ...b, text: b.text + e.delta };
                } else {
                  copy.push({ kind: "bot", text: e.delta });
                  botIndex = copy.length - 1;
                }
                return copy;
              });
              break;
            case "status":
              setStatus(e.label);
              break;
            case "profile":
              setProfile(e.profile);
              break;
            case "chips":
              setMsgs((m) => {
                const copy = [...m];
                const idx = botIndex >= 0 ? botIndex : copy.length - 1;
                const b = copy[idx];
                if (b?.kind === "bot") copy[idx] = { ...b, chips: { mode: e.mode, options: e.options } };
                return copy;
              });
              break;
            case "bundle":
              setMsgs((m) => [...m, { kind: "bundle", quote: e.quote, recommendation: e.recommendation }]);
              // Remember the plan on this device so the landing page can offer "continue" instead of starting over.
              try {
                if (sessionRef.current) localStorage.setItem("accel:plan", JSON.stringify({ id: sessionRef.current, monthly: e.quote?.monthlyWithGst, at: Date.now() }));
              } catch {}
              botIndex = -1; // text after the bill starts a new bubble
              break;
            case "handoff":
              setMsgs((m) => [...m, { kind: "handoff", reason: e.reason }]);
              botIndex = -1;
              break;
            case "error":
              setMsgs((m) => [...m, { kind: "bot", text: e.message }]);
              break;
          }
        }
      } catch {
        setMsgs((m) => [...m, { kind: "bot", text: "The connection dropped before I could finish. Tap to send that again.", chips: { mode: "single", options: [{ label: "Try again", value: message }] } }]);
      } finally {
        clearTimeout(watchdog);
        setBusy(false);
        setStatus("");
      }
      // Hands-free: speak the reply, then listen for the answer.
      if (voiceRef.current && spoken.trim()) {
        await voice.speak(spoken);
        if (voiceRef.current && autoListenRef.current) voice.listen((text) => void sendRef.current?.(text));
      }
    },
    [busy, lang, voice],
  );

  sendRef.current = send;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // One-tap starts from the landing page (?q=I run a kirana store, or a GSTIN) skip the opening questions.
    const q = params.get("q")?.trim().slice(0, 200);
    void send(q ?? "");
  }, [send, params]);

  const startListening = () => voice.listen((text) => void send(text));
  const lastBot = [...msgs].reverse().find((m) => m.kind === "bot") as Extract<Msg, { kind: "bot" }> | undefined;
  const chips = !busy ? lastBot?.chips : undefined;
  const facts = profileFacts(profile);
  const hasBundle = msgs.some((m) => m.kind === "bundle");
  const lastBundle = [...msgs].reverse().find((m) => m.kind === "bundle") as Extract<Msg, { kind: "bundle" }> | undefined;
  const planIds = lastBundle ? lastBundle.quote.lines.filter((l) => l.active && !l.blockedReason).map((l) => l.productId) : [];
  const desktop = useMedia("(min-width: 1024px)");

  return (
    <div className="flex h-dvh flex-col">
      <TopBar wide>
        <select
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-full border border-rule bg-sheet px-2.5 py-1 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setVoiceMode((v) => !v);
            voice.stopSpeaking();
          }}
          aria-pressed={voiceMode}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${voiceMode ? "border-brand bg-brand text-white" : "border-rule bg-sheet"}`}
        >
          {voiceMode ? <Headphones size={15} /> : <Keyboard size={15} />} {voiceMode ? "Voice" : "Text"}
        </button>
      </TopBar>

      {facts.length > 0 && (
        <div className="border-b border-rule bg-sheet">
          <div className="no-scrollbar mx-auto flex max-w-xl items-center gap-1.5 overflow-x-auto px-4 py-2 text-[13px]">
            <span className="shrink-0 text-ink-soft">I understood:</span>
            {facts.map((f) => (
              <span key={f} className="shrink-0 rounded-md bg-paper px-2 py-0.5 font-medium">{f}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-3 px-4 py-4" aria-live="polite">
          {msgs.map((m, i) =>
            m.kind === "user" ? (
              <div key={i} className="chip-in ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-white shadow-[var(--shadow-card)]">{m.text}</div>
            ) : m.kind === "bot" ? (
              <div key={i} lang={lang} className="chip-in max-w-[92%] rounded-2xl rounded-bl-md border border-rule bg-sheet px-4 py-3 leading-relaxed shadow-[var(--shadow-card)]">
                <Rich text={m.text} />
              </div>
            ) : m.kind === "bundle" ? (
              <div key={i} className="chip-in max-w-[92%]">
                {!desktop && m === lastBundle && (
                  <div className="card mb-3 overflow-hidden">
                    <Shop3D items={planIds} className="h-60 w-full" />
                    <div className="border-t border-rule px-4 py-2 text-sm text-ink-soft">Your shop, connected — {planIds.length} services</div>
                  </div>
                )}
                <Bill quote={m.quote} businessName={profile?.businessName} compact />
                <Link href={`/quote/${sessionRef.current}`} className="mt-2 flex items-center justify-center rounded-xl bg-brand px-4 py-3 text-center font-bold text-white">
                  Review and adjust my plan
                </Link>
              </div>
            ) : (
              <div key={i} className="flex max-w-[92%] items-start gap-3 rounded-2xl border border-rule bg-sheet px-4 py-3">
                <UserRound className="mt-0.5 shrink-0 text-wa" size={20} />
                <div>
                  <div className="font-semibold">A local Accel partner will call you</div>
                  <div className="text-sm text-ink-soft">They&apos;ll see this conversation, so you won&apos;t need to repeat anything.</div>
                </div>
              </div>
            ),
          )}
          {(busy && !lastBot) || status ? (
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <Loader2 size={15} className="animate-spin" /> {status || "Thinking…"}
            </div>
          ) : null}
          {chips && (
            <div className="flex flex-wrap gap-2 pt-1">
              {chips.options.map((c) => {
                const on = multi.includes(c.value);
                return (
                  <button
                    key={c.value}
                    onClick={() => (chips.mode === "multi" ? setMulti((s) => (on ? s.filter((x) => x !== c.value) : [...s, c.value])) : void send(c.value, c.label))}
                    aria-pressed={chips.mode === "multi" ? on : undefined}
                    className={`chip-in inline-flex items-center gap-1 rounded-full border px-3.5 py-2 text-[15px] shadow-[var(--shadow-card)] transition-all ${on ? "border-brand bg-brand text-white" : "border-rule bg-sheet hover:-translate-y-0.5 hover:border-ink-soft"}`}
                  >
                    {on && <Check size={14} />} {c.label}
                  </button>
                );
              })}
              {chips.mode === "multi" && (
                <button
                  onClick={() => void send(`needs:${multi.join(",")}`, multi.length ? chips.options.filter((o) => multi.includes(o.value)).map((o) => o.label).join(", ") : "Just internet")}
                  className="rounded-full bg-brand px-4 py-2 font-bold text-white"
                >
                  {multi.length ? `Done (${multi.length})` : "Just internet for now"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {desktop && (
        <aside className="relative hidden w-[46%] max-w-[720px] border-l border-rule bg-gradient-to-b from-sheet/60 to-transparent lg:block" aria-label="Your connected shop">
          <Shop3D items={planIds} className="absolute inset-0" />
          <div className="absolute inset-x-6 top-6">
            <h2 className="text-xl font-extrabold tracking-tight">{planIds.length ? "Your shop, connected" : "Your shop"}</h2>
            <p className="text-sm text-ink-soft">{planIds.length ? "Everything in your plan, in one place and one bill." : "Tell me about your business — I'll connect it piece by piece."}</p>
          </div>
          {planIds.length > 0 && (
            <ul className="absolute inset-x-6 bottom-6 flex flex-wrap gap-2">
              {planIds.map((id) => (
                <li key={id} className="chip-in inline-flex items-center gap-1.5 rounded-full border border-rule bg-sheet/90 px-3 py-1 text-sm font-semibold shadow-[var(--shadow-card)] backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-signal" /> {VISUAL_LABEL[id] ?? id}
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
      </div>

      <div className="border-t border-rule bg-sheet/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3">
          {voiceMode ? (
            <div className="flex flex-col items-center gap-2">
              <div className="min-h-6 text-center text-ink-soft" aria-live="polite">
                {voice.listening ? voice.interim || "Listening…" : voice.speaking ? "Speaking… tap the mic to interrupt" : !voice.supported ? "Voice isn't supported in this browser. Switch to Text, or use Chrome." : "Tap the mic and speak"}
              </div>
              <button
                onClick={() => (voice.listening ? voice.stopListening() : startListening())}
                disabled={!voice.supported || busy}
                aria-label={voice.listening ? "Stop listening" : "Speak"}
                className={`grid h-16 w-16 place-items-center rounded-full bg-brand text-white disabled:opacity-40 ${voice.listening ? "mic-live" : ""}`}
              >
                {voice.listening ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
              </button>
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim()) return;
                void send(input.trim());
                setInput("");
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                lang={lang}
                placeholder={hasBundle ? "Ask anything, or change the plan…" : "Type here, or share your GSTIN"}
                className="min-w-0 flex-1 rounded-full border border-rule bg-sheet px-4 py-3"
                aria-label="Message"
              />
              {voice.supported && (
                <button type="button" onClick={startListening} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border border-rule bg-sheet ${voice.listening ? "mic-live" : ""}`} aria-label="Speak instead">
                  <Mic size={20} />
                </button>
              )}
              <button disabled={busy || !input.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40" aria-label="Send">
                <Send size={18} />
              </button>
            </form>
          )}
          <div className="mt-2 text-center text-xs text-ink-soft">
            {mode === "ai" || mode === "guided" ? "Prices are Accel's published prices. Nobody can bend them, not even the advisor." : " "}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <Suspense>
      <Advisor />
    </Suspense>
  );
}
