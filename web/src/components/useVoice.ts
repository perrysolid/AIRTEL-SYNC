"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice in and out, in the owner's language.
 * - Listening: the browser's speech recogniser (Chrome/Android support hi-IN,
 *   ta-IN, te-IN, kn-IN, ml-IN, mr-IN, bn-IN, gu-IN, pa-IN, en-IN).
 * - Speaking: server TTS (/api/tts, natural Indic voices when configured),
 *   falling back to the device's own voices.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Text that reads well aloud: no markdown, no emoji, ₹ spoken. */
export function speakable(text: string): string {
  return text
    .replace(/\*\*?(.+?)\*\*?/g, "$1")
    .replace(/^[•\-]\s*/gm, "")
    .replace(/₹\s?([\d,]+)/g, (_, n) => `${n} rupees`)
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\n+/g, ". ")
    .slice(0, 900);
}

export function useVoice(bcp47: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setSupported(!!recognitionCtor()), []);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const listen = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = recognitionCtor();
      if (!Ctor) return;
      stopSpeaking(); // barge-in: the owner can interrupt the advisor
      recRef.current?.abort();
      const rec = new Ctor();
      rec.lang = bcp47;
      rec.interimResults = true;
      rec.continuous = false;
      let finalText = "";
      rec.onresult = (e) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else live += r[0].transcript;
        }
        setInterim(finalText + live);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => {
        setListening(false);
        setInterim("");
        if (finalText.trim()) onFinal(finalText.trim());
      };
      recRef.current = rec;
      setListening(true);
      rec.start();
    },
    [bcp47, stopSpeaking],
  );

  const stopListening = useCallback(() => recRef.current?.stop(), []);

  /** Speaks the text; resolves when playback ends (so hands-free mode can listen next). */
  const speak = useCallback(
    async (text: string): Promise<void> => {
      const say = speakable(text);
      if (!say.trim()) return;
      stopSpeaking();
      setSpeaking(true);
      try {
        const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: say, lang: bcp47 }) });
        if (r.status === 200) {
          const audio = new Audio(URL.createObjectURL(await r.blob()));
          audioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = audio.onpause = () => resolve();
            audio.play().catch(() => resolve());
          });
          setSpeaking(false);
          return;
        }
      } catch {
        /* fall back to device voice */
      }
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!synth) return setSpeaking(false);
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(say);
        u.lang = bcp47;
        const voices = synth.getVoices();
        const v = voices.find((x) => x.lang === bcp47) ?? voices.find((x) => x.lang.startsWith(bcp47.slice(0, 2)));
        if (v) u.voice = v;
        u.rate = 1.02;
        u.onend = u.onerror = () => resolve();
        synth.speak(u);
      });
      setSpeaking(false);
    },
    [bcp47, stopSpeaking],
  );

  return { supported, listening, speaking, interim, listen, stopListening, speak, stopSpeaking };
}
