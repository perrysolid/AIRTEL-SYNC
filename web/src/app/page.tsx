"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCheck, MessageCircle, Mic, MessageSquareText, Search, Send } from "lucide-react";
import { Bazaar3D, BAZAAR_STEPS } from "@/components/bazaar/Bazaar3D";
import { Logo, LogoMark } from "@/components/Brand";
import { HeroMenu } from "@/components/HeroMenu";
import { NetworkBackdrop } from "@/components/NetworkBackdrop";
import { Reveal } from "@/components/Reveal";
import { NewsFlashes } from "@/components/NewsFlashes";
import { PlanDock } from "@/components/PlanDock";
import { QuickStart } from "@/components/QuickStart";
import { StepsCarousel } from "@/components/StepsCarousel";
import { ToolsStage } from "@/components/ToolsStage";
import { PhoneMock } from "@/components/PhoneMock";
import { PromoBar, SiteFooter } from "@/components/SiteNav";
import { AccountButton, WelcomeBack } from "@/components/Account";
import { TelegramLogo, WhatsAppLogo } from "@/components/BrandIcons";
import { LangPicker } from "@/components/LangPicker";

const GREETING: Record<string, { line: string; sub: string; talk: string; type: string; chat: string }> = {
  en: { line: "Chhota business. Bada connection.", sub: "Fibre, business SIMs, UPI billing and CCTV for kirana stores, clinics, workshops and every MSME in between. One plan, one GST bill, set up on WhatsApp in your language.", talk: "Talk to the advisor", type: "Type instead", chat: "Or chat on" },
  hi: { line: "छोटा बिज़नेस, बड़ा कनेक्शन।", sub: "दुकान के लिए इंटरनेट, बिज़नेस नंबर, बिलिंग और CCTV — एक प्लान, एक बिल। अपनी भाषा में चैट से सेटअप, कुछ ही दिनों में चालू।", talk: "सलाहकार से बात करें", type: "लिखकर बताएँ", chat: "या चैट करें" },
  mr: { line: "छोटा व्यवसाय, मोठं कनेक्शन.", sub: "दुकानासाठी इंटरनेट, बिझनेस नंबर, बिलिंग आणि CCTV — एक प्लॅन, एक बिल. तुमच्या भाषेत चॅटवरून सेटअप.", talk: "सल्लागाराशी बोला", type: "टाइप करा", chat: "किंवा चॅट करा" },
  ta: { line: "சிறு தொழில், பெரிய இணைப்பு.", sub: "உங்கள் கடைக்கு இணையம், வணிக எண்கள், பில்லிங், CCTV — ஒரே திட்டம், ஒரே பில். உங்கள் மொழியில் சாட் மூலம் அமைப்பு.", talk: "ஆலோசகரிடம் பேசுங்கள்", type: "தட்டச்சு செய்யுங்கள்", chat: "அல்லது சாட் செய்யுங்கள்" },
  te: { line: "చిన్న వ్యాపారం, పెద్ద కనెక్షన్.", sub: "మీ షాపు కోసం ఇంటర్నెట్, బిజినెస్ నంబర్లు, బిల్లింగ్, CCTV — ఒకే ప్లాన్, ఒకే బిల్. మీ భాషలో చాట్ ద్వారా సెటప్.", talk: "సలహాదారుతో మాట్లాడండి", type: "టైప్ చేయండి", chat: "లేదా చాట్ చేయండి" },
  kn: { line: "ಸಣ್ಣ ವ್ಯಾಪಾರ, ದೊಡ್ಡ ಕನೆಕ್ಷನ್.", sub: "ನಿಮ್ಮ ಅಂಗಡಿಗೆ ಇಂಟರ್ನೆಟ್, ಬಿಸಿನೆಸ್ ನಂಬರ್, ಬಿಲ್ಲಿಂಗ್, CCTV — ಒಂದೇ ಪ್ಲಾನ್, ಒಂದೇ ಬಿಲ್. ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಚಾಟ್ ಮೂಲಕ ಸೆಟಪ್.", talk: "ಸಲಹೆಗಾರರೊಂದಿಗೆ ಮಾತನಾಡಿ", type: "ಟೈಪ್ ಮಾಡಿ", chat: "ಅಥವಾ ಚಾಟ್ ಮಾಡಿ" },
  gu: { line: "નાનો બિઝનેસ, મોટું કનેક્શન.", sub: "તમારી દુકાન માટે ઇન્ટરનેટ, બિઝનેસ નંબર, બિલિંગ અને CCTV — એક પ્લાન, એક બિલ. તમારી ભાષામાં ચેટથી સેટઅપ.", talk: "સલાહકાર સાથે વાત કરો", type: "ટાઇપ કરો", chat: "અથવા ચેટ કરો" },
  bn: { line: "ছোট ব্যবসা, বড় কানেকশন।", sub: "আপনার দোকানের জন্য ইন্টারনেট, বিজনেস নম্বর, বিলিং ও CCTV — এক প্ল্যান, এক বিল। নিজের ভাষায় চ্যাটে সেটআপ।", talk: "পরামর্শদাতার সাথে কথা বলুন", type: "টাইপ করুন", chat: "অথবা চ্যাট করুন" },
  ml: { line: "ചെറിയ ബിസിനസ്, വലിയ കണക്ഷൻ.", sub: "നിങ്ങളുടെ കടയ്ക്ക് ഇന്റർനെറ്റ്, ബിസിനസ് നമ്പർ, ബില്ലിംഗ്, CCTV — ഒരു പ്ലാൻ, ഒരു ബിൽ. നിങ്ങളുടെ ഭാഷയിൽ ചാറ്റ് വഴി സെറ്റപ്പ്.", talk: "ഉപദേഷ്ടാവിനോട് സംസാരിക്കൂ", type: "ടൈപ്പ് ചെയ്യൂ", chat: "അല്ലെങ്കിൽ ചാറ്റ് ചെയ്യൂ" },
  pa: { line: "ਛੋਟਾ ਕਾਰੋਬਾਰ, ਵੱਡਾ ਕਨੈਕਸ਼ਨ।", sub: "ਤੁਹਾਡੀ ਦੁਕਾਨ ਲਈ ਇੰਟਰਨੈੱਟ, ਬਿਜ਼ਨਸ ਨੰਬਰ, ਬਿਲਿੰਗ ਅਤੇ CCTV — ਇੱਕ ਪਲਾਨ, ਇੱਕ ਬਿੱਲ। ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਚੈਟ ਰਾਹੀਂ ਸੈੱਟਅੱਪ।", talk: "ਸਲਾਹਕਾਰ ਨਾਲ ਗੱਲ ਕਰੋ", type: "ਟਾਈਪ ਕਰੋ", chat: "ਜਾਂ ਚੈਟ ਕਰੋ" },
};

const TELEGRAM = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "UdyamAdvisorBot";

/** Where the scroll zoom runs: wide and tall enough to hold the section in one screen, and motion allowed. Same query as globals.css. */
const ZOOM_QUERY = "(min-width: 1024px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)";
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * Two swipes. First swipe: the words lift away and blur, the side phones swing out and fade, the night sky dissolves
 * to white, and the centre phone straightens up and rises to the middle of the screen. Second swipe: its screen opens
 * into the "come alive" section while the titanium frame dissolves, so the hardware never sits on top of the page.
 * Scroll-snap stops (see .zoom-snap) make each swipe land on a step. Progress goes straight to inline styles.
 *
 * Everywhere (phones included), the three phones stand in perspective and lean gently towards the pointer.
 */
function useHeroZoom() {
  const runway = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const fly = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const sideL = useRef<HTMLDivElement>(null);
  const sideR = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const frameEl = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(ZOOM_QUERY);
    const on = () => setEnhanced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Pointer tilt: the phones lean a few degrees towards the pointer, eased so they glide rather than jitter.
  useEffect(() => {
    const rw = runway.current;
    if (!rw || !window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let raf = 0;
    const cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
    const tick = () => {
      cur.x += (tgt.x - cur.x) * 0.08;
      cur.y += (tgt.y - cur.y) * 0.08;
      rw.style.setProperty("--tx", cur.x.toFixed(3));
      rw.style.setProperty("--ty", cur.y.toFixed(3));
      raf = Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.01 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      tgt.x = (e.clientX / window.innerWidth - 0.5) * 12;
      tgt.y = (e.clientY / window.innerHeight - 0.5) * 8;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const rw = runway.current, ov = overlay.current, sl = slot.current, fl = fly.current, sc = screen.current, ly = layer.current;
    if (!enhanced || !rw || !ov || !sl || !fl || !sc || !ly) return;
    const moved = [copy.current, sideL.current, sideR.current, veil.current, frameEl.current];
    let raf = 0;
    let shown = false;
    let size = { w: 0, h: 0 };

    const frame = () => {
      raf = 0;
      const box = ov.getBoundingClientRect();
      const vh = box.height;
      const p = clamp01(-rw.getBoundingClientRect().top / Math.max(1, vh));
      const a = ease(clamp01(p / 0.5));
      const b = ease(clamp01((p - 0.5) / 0.5));
      const lift = ease(clamp01(p / 0.32));

      // the words and the side phones leave first; the sky dissolves to white behind the rising phone
      const cp = copy.current;
      if (cp) {
        cp.style.opacity = (1 - lift).toFixed(3);
        cp.style.transform = `translateY(${(-lift * 56).toFixed(1)}px) scale(${(1 - lift * 0.04).toFixed(4)})`;
        cp.style.filter = lift > 0.001 ? `blur(${(lift * 8).toFixed(1)}px)` : "";
      }
      for (const [el, dir] of [[sideL.current, -1], [sideR.current, 1]] as const) {
        if (!el) continue;
        el.style.transform = `perspective(1400px) translateX(${(dir * lift * 16).toFixed(2)}vw) rotateY(${(-dir * lift * 55).toFixed(2)}deg)`;
        el.style.opacity = (1 - lift).toFixed(3);
      }
      if (veil.current) veil.current.style.opacity = ease(clamp01((p - 0.06) / 0.4)).toFixed(3);
      if (frameEl.current) frameEl.current.style.opacity = (1 - clamp01(b * 1.7)).toFixed(3);

      // where the phone sits in the landing page right now (it scrolls up with the page)
      const s = sl.getBoundingClientRect();
      if (s.width !== size.w || s.height !== size.h) {
        size = { w: s.width, h: s.height };
        fl.style.width = `${s.width}px`;
        fl.style.height = `${s.height}px`;
      }
      const k = 1 + ((vh * 0.6) / s.height - 1) * a; // rises to a little over half the screen, never fills it
      const x0 = s.left - box.left, y0 = s.top - box.top;
      const x1 = box.width / 2 - s.width / 2, y1 = vh / 2 - s.height / 2;
      // it starts tipped back like the side phones and straightens up as it rises
      fl.style.transform = `translate3d(${(x0 + (x1 - x0) * a).toFixed(1)}px, ${(y0 + (y1 - y0) * a).toFixed(1)}px, 0) perspective(1600px) rotateX(calc(${(9 * (1 - a)).toFixed(2)}deg - var(--ty, 0) * ${(1 - a).toFixed(3)}deg)) rotateY(calc(var(--tx, 0) * ${(1 - a).toFixed(3)}deg)) scale(${(k * (1 + 0.1 * b)).toFixed(4)})`;

      // the section opens out of wherever the phone's screen is
      const sr = sc.getBoundingClientRect();
      const inset = [sr.top - box.top, box.right - sr.right, box.bottom - sr.bottom, sr.left - box.left].map((v) => `${(Math.max(0, v) * (1 - b)).toFixed(1)}px`);
      ly.style.clipPath = b >= 1 ? "none" : `inset(${inset.join(" ")} round ${(sr.width * 0.13 * (1 - b)).toFixed(1)}px)`;
      ly.style.opacity = clamp01(b * 3).toFixed(3);
      fl.style.opacity = b >= 1 ? "0" : "1";

      const now = p > 0.7;
      if (now !== shown) {
        shown = now;
        setRevealed(now);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      ly.style.clipPath = "";
      ly.style.opacity = "";
      for (const el of moved) if (el) el.removeAttribute("style");
      setRevealed(false);
    };
  }, [enhanced]);

  return { runway, overlay, slot, fly, screen, layer, copy, sideL, sideR, veil, frameEl, enhanced, revealed };
}


/** The chat the owner sees: their plan, then every step of the order arriving by itself (sizes in cqw: the phone's width). */
const CHAT: { me?: boolean; text: string; plan?: boolean }[] = [
  { me: true, text: "Kirana in Indore, 2 people. Need internet and UPI billing." },
  { text: "Here's your plan", plan: true },
  { text: "✅ Business verified" },
  { text: "💳 Payment received. Installation booked for tomorrow, 10 am." },
  { text: "📶 Fibre is live. Your shop is online!" },
];

function MiniChat() {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(CHAT.length);
    const t = setInterval(() => setN((k) => (k >= CHAT.length + 2 ? 1 : k + 1)), 1600);
    return () => clearInterval(t);
  }, []);
  const shown = CHAT.slice(0, Math.min(n, CHAT.length));
  const typing = n < CHAT.length && !CHAT[n]?.me;
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col bg-[#efeae2] text-ink" style={{ top: "4.8%" }} aria-hidden inert>
      <div className="flex items-center gap-[2.6cqw] bg-white px-[4.5cqw] py-[3cqw] shadow-[0_1px_0_rgb(0_0_0/0.06)]">
        <LogoMark className="h-[9cqw] w-[9cqw]" />
        <div className="leading-tight">
          <div className="text-[4.2cqw] font-extrabold">Accel Business</div>
          <div className="text-[3.1cqw] text-wa">online</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-[2.2cqw] overflow-hidden px-[3.6cqw] pb-[4cqw]">
        {shown.map((m, i) => (
          <div key={i} className={`chip-in max-w-[82%] rounded-[3cqw] px-[3cqw] py-[2cqw] text-[3.5cqw] leading-snug shadow-[0_1px_1px_rgb(0_0_0/0.08)] ${m.me ? "self-end rounded-tr-[0.6cqw] bg-[#d9fdd3]" : "self-start rounded-tl-[0.6cqw] bg-white"}`}>
            {m.plan ? (
              <div className="grid gap-[1cqw]">
                <span className="font-bold">{m.text}</span>
                <span className="rounded-[2cqw] bg-brand-soft px-[2.4cqw] py-[1.6cqw]">
                  <span className="block text-[5.6cqw] leading-none font-extrabold text-brand">₹2,697<span className="text-[3cqw] font-semibold text-ink-soft">/month</span></span>
                  <span className="mt-[0.8cqw] block text-[3cqw] text-ink-soft">Fibre 100 · UPI billing · one GST bill</span>
                </span>
              </div>
            ) : (
              m.text
            )}
            {!m.me && <span className="ml-[1.4cqw] text-[2.6cqw] text-ink-soft">now</span>}
            {m.me && <CheckCheck className="ml-[1cqw] inline h-[3.2cqw] w-[3.2cqw] text-[#53bdeb]" />}
          </div>
        ))}
        {typing && (
          <div className="flex gap-[1cqw] self-start rounded-[3cqw] bg-white px-[3cqw] py-[2.6cqw]">
            {[0, 1, 2].map((d) => <span key={d} className="typing-dot h-[1.6cqw] w-[1.6cqw] rounded-full bg-ink-soft" style={{ animationDelay: `${d * 160}ms` }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState("en");
  const [orderId, setOrderId] = useState("");
  const router = useRouter();
  const g = GREETING[lang] ?? GREETING.en;
  const [shop, setShop] = useState(-1);
  const z = useHeroZoom();
  const show = z.enhanced ? z.revealed : undefined;

  return (
    <div id="top" className="min-h-dvh">
      <PromoBar />

      <div ref={z.runway} className="zoom-runway relative">
        {/* scroll-snap stops: the top of the page, the phone in the middle, the section fully open */}
        {["-2rem", "50dvh", "100dvh"].map((top) => <div key={top} aria-hidden className="zoom-snap" style={{ top }} />)}
          {/* ---------------------------------------------------------------- hero: a live network, one line, three phones on a stage */}
          <section className="zoom-hero relative isolate flex min-h-[calc(100dvh-2rem)] flex-col overflow-hidden bg-[#050a1c] text-white">
            <div className="zoom-bg absolute inset-0 -z-20"><NetworkBackdrop className="absolute inset-0" /></div>
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#050a1c]/70 via-[#050a1c]/20 to-[#050a1c]/80" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(48rem_20rem_at_50%_52%,rgb(5_10_28/0.8),transparent_72%)]" />

            {/* the two corners: brand on the left, menu on the right, on the same baseline and the same inset */}
            <header className="flex h-[4.5rem] w-full items-center justify-between px-[clamp(1rem,3vw,2.75rem)]">
              <Logo onDark />
              <div className="flex items-center gap-2">
                <LangPicker lang={lang} onLang={setLang} onDark />
                <AccountButton onDark />
                <HeroMenu lang={lang} onLang={setLang} telegram={TELEGRAM} />
              </div>
            </header>

            {/* the message sits in the middle, just above the stage; the background does the rest of the talking */}
            <div ref={z.copy} className="zoom-copy flex flex-1 flex-col items-center justify-end px-4 pb-[clamp(1.25rem,4.5dvh,3rem)] text-center">
              <WelcomeBack />
              <h1 key={lang} lang={lang} className="rise max-w-[22ch] text-[clamp(1.9rem,5.2vw,3.6rem)] leading-[1.08] font-extrabold tracking-tight text-balance [text-shadow:0_2px_30px_rgb(0_0_0/0.7)]" style={{ ["--i" as string]: 1 }}>
                {g.line}
              </h1>
              <p lang={lang} className="rise mt-[clamp(0.6rem,1.6dvh,1rem)] max-w-[34rem] text-[clamp(0.9rem,1.9dvh,1.05rem)] leading-snug text-white/80 [text-shadow:0_1px_18px_rgb(0_0_0/0.7)]" style={{ ["--i" as string]: 2 }}>
                {g.sub}
              </p>
              <div className="rise mt-[clamp(1rem,2.6dvh,1.6rem)] flex flex-wrap items-center justify-center gap-3" style={{ ["--i" as string]: 3 }}>
                <button
                  onClick={() => router.push(`/advisor?lang=${lang}&voice=1`)}
                  className="group inline-flex items-center gap-2.5 rounded-full bg-brand py-1.5 pr-5 pl-1.5 text-[15px] font-extrabold text-white shadow-[0_14px_32px_-12px_var(--brand)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-brand transition-transform group-hover:scale-105"><Mic size={18} strokeWidth={2.4} /></span>
                  <span lang={lang}>{g.talk}</span>
                </button>
                <Link href={`/advisor?lang=${lang}`} lang={lang} className="inline-flex h-[2.9rem] items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 text-[15px] font-semibold text-white backdrop-blur transition-transform hover:-translate-y-0.5 hover:bg-white/20">
                  <MessageSquareText size={17} /> {g.type}
                </Link>
              </div>
              <div className="rise mt-3 flex flex-wrap items-center justify-center gap-2 text-sm" style={{ ["--i" as string]: 4 }}>
                <span lang={lang} className="text-white/65">{g.chat}</span>
                <Link href={`/whatsapp?lang=${lang}`} className="inline-flex h-9 items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1.5 font-bold text-[#0b3d2e] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] transition-transform hover:-translate-y-0.5">
                  <WhatsAppLogo className="h-6 w-6" /> WhatsApp
                </Link>
                <a href={`https://t.me/${TELEGRAM}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1.5 font-bold text-[#0b3550] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] transition-transform hover:-translate-y-0.5">
                  <TelegramLogo className="h-6 w-6" /> Telegram
                </a>
              </div>
            </div>

            {/* ------------------------------------------- the stage: a low white arc, three phones standing on it, sized from one number */}
            <div
              role="group"
              aria-label="The product on a phone"
              className="relative mx-auto w-full flex-none"
              style={{ ["--ph" as string]: "min(40dvh, 62vw, 400px)", height: "calc(var(--ph) * 0.86)" }}
            >
              <div aria-hidden className="zoom-arc pointer-events-none absolute inset-0">
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(255_255_255/0.55),0_-8px_60px_rgb(228_0_0/0.35)]"
                  style={{ top: "calc(var(--ph) * 0.34)", width: "calc(var(--ph) * 2.4)", height: "calc(var(--ph) * 2.4)" }}
                />
              </div>
              <div className="absolute inset-x-0 flex items-end justify-center" style={{ bottom: "calc(var(--ph) * -0.14)", gap: "calc(var(--ph) * 0.07)" }}>
                <div ref={z.sideL} className="zoom-side-l">
                  <div className="phone-in" style={{ ["--i" as string]: 1, height: "calc(var(--ph) * 0.8)", transform: "translateY(calc(var(--ph) * 0.02))" }}>
                    <div className="hero-float h-full" style={{ ["--fd" as string]: "-1.5s", transform: "perspective(1400px) rotateY(calc(24deg + var(--tx, 0) * 1deg)) rotateX(calc(6deg - var(--ty, 0) * 1deg)) rotateZ(-2deg)" }}>
                      <PhoneMock className="h-full" src="/screens/advisor.png" alt="The advisor recommends a plan with a clear monthly price" />
                    </div>
                  </div>
                </div>
                {/* the centre phone's place; on wide screens the phone itself flies from here (see the overlay below) */}
                <div ref={z.slot} className="relative z-10" style={{ height: "var(--ph)", aspectRatio: "0.475" }}>
                  {!z.enhanced && (
                    <div className="phone-in h-full" style={{ ["--i" as string]: 0 }}>
                      <div className="h-full" style={{ transform: "perspective(1600px) rotateX(calc(9deg - var(--ty, 0) * 1deg)) rotateY(calc(var(--tx, 0) * 1deg))" }}>
                        <PhoneMock className="h-full">
                          <MiniChat />
                        </PhoneMock>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={z.sideR} className="zoom-side-r">
                  <div className="phone-in" style={{ ["--i" as string]: 2, height: "calc(var(--ph) * 0.8)", transform: "translateY(calc(var(--ph) * 0.02))" }}>
                    <div className="hero-float h-full" style={{ ["--fd" as string]: "-4s", transform: "perspective(1400px) rotateY(calc(-24deg + var(--tx, 0) * 1deg)) rotateX(calc(6deg - var(--ty, 0) * 1deg)) rotateZ(2deg)" }}>
                      <PhoneMock className="h-full" src="/screens/shield.png" alt="Scam Shield flags a fake message asking for your documents and says what to do" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div aria-hidden className="zoom-fade pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[clamp(44px,8dvh,84px)] bg-gradient-to-b from-transparent to-white" />
          </section>

          {/* ---------------------------------------------------------------- the 3D shop that builds itself, the ways in, and order tracking.
              It sits right below the landing page. On wide screens it is pinned while it opens out of the centre phone's
              screen, and the phone flies here from its place in the landing page; elsewhere it simply follows the hero. */}
          <div className="zoom-track">
          <div ref={z.overlay} className="zoom-overlay">
            {z.enhanced && <div ref={z.veil} aria-hidden className="pointer-events-none absolute inset-0 bg-white opacity-0" />}
            {z.enhanced && (
              <div ref={z.fly} aria-hidden className="zoom-fly pointer-events-none absolute top-0 left-0 z-10">
                <div className="phone-in h-full" style={{ ["--i" as string]: 0 }}>
                  <PhoneMock className="h-full" screenRef={z.screen} frameRef={z.frameEl}>
                    <MiniChat />
                  </PhoneMock>
                </div>
              </div>
            )}
          <section ref={z.layer} inert={z.enhanced && !z.revealed} aria-labelledby="alive" className="zoom-reveal bg-white">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-8 px-4 pt-6 pb-[clamp(3rem,7vw,5.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
              <div className="min-w-0">
                <Reveal show={show}>
                  <span aria-hidden className="mb-3 block h-1 w-12 rounded-full bg-brand" />
                  <h2 id="alive" className="text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.08] font-extrabold tracking-tight text-balance">
                    One connection. <span className="sweep">Every shop</span> on the street.
                  </h2>
                </Reveal>
                <Reveal show={show} delay={120}>
                  <p className="mt-4 max-w-lg text-lg text-ink-soft">Kirana, clinic, salon or chai stall: tell us what you run and we connect what it needs. Fibre, UPI billing, business SIMs, Wi-Fi and CCTV, on one bill, with every step sent to your WhatsApp.</p>
                </Reveal>
                <Reveal show={show} delay={240}>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => router.push(`/advisor?lang=${lang}&voice=1`)}
                      className="group inline-flex items-center gap-2.5 rounded-full bg-brand py-1.5 pr-5 pl-1.5 text-[15px] font-extrabold text-white shadow-[0_14px_30px_-14px_var(--brand)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-brand transition-transform group-hover:scale-105"><Mic size={18} strokeWidth={2.4} /></span>
                      <span lang={lang}>{g.talk}</span>
                    </button>
                    <Link href={`/advisor?lang=${lang}`} lang={lang} className="inline-flex h-[2.9rem] items-center gap-2 rounded-full border border-ink/20 px-5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5 hover:bg-paper">
                      <MessageSquareText size={17} /> {g.type}
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[15px] font-semibold">
                    <Link href={`/whatsapp?lang=${lang}`} className="inline-flex items-center gap-1.5 text-wa underline-offset-4 hover:underline"><MessageCircle size={16} /> Continue on WhatsApp</Link>
                    <a href={`https://t.me/${TELEGRAM}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#0a6fb0] underline-offset-4 hover:underline"><Send size={16} /> Chat on Telegram</a>
                  </div>
                  <QuickStart lang={lang} />
                </Reveal>
                <Reveal show={show} delay={360}>
                  <form
                    id="track"
                    className="card mt-6 max-w-lg scroll-mt-24 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (orderId.trim()) router.push(`/order/${orderId.trim().toUpperCase()}`);
                    }}
                  >
                    <label htmlFor="track-id" className="text-sm font-semibold">Already ordered? Check your status</label>
                    <div className="mt-2 flex gap-2">
                      <input id="track-id" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID, e.g. ACC-3F9A2C71D0" className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2.5 uppercase placeholder:normal-case" />
                      <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 font-semibold text-white"><Search size={16} /> Track</button>
                    </div>
                  </form>
                </Reveal>
              </div>
              <Reveal show={show} delay={200} className="relative h-[300px] sm:h-[380px] lg:h-[480px]">
                <Bazaar3D className="absolute inset-0" onStep={setShop} />
                <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                  {shop >= 0 && (
                    <span key={shop} className="chip-in inline-flex items-center gap-2 rounded-full border border-rule bg-sheet/90 px-3.5 py-1.5 text-sm font-semibold shadow-[var(--shadow-card)] backdrop-blur">
                      <span className="h-2 w-2 rounded-full bg-signal" /> {BAZAAR_STEPS[shop]} connected
                    </span>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
          </div>
          </div>
          {/* holds the section's own screen of the page, right under the landing page, so nothing below is covered */}
          <div aria-hidden className="zoom-spacer" />
      </div>

      <ToolsStage />

      {/* ------------------------------------------------------------------ from hello to live: the steps on a slowly turning ring */}
      <section aria-labelledby="how" className="overflow-hidden bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-16">
          <Reveal className="text-center">
            <div className="text-xs font-bold tracking-[0.16em] text-brand uppercase">How it works</div>
            <h2 id="how" className="mt-2 text-[clamp(1.7rem,3.6vw,3rem)] leading-tight font-extrabold tracking-tight text-balance lg:whitespace-nowrap">From hello to live, without a single follow-up call</h2>
            <p className="mx-auto mt-3 max-w-4xl text-lg text-ink-soft">Six steps, all on your phone and in your language: talk, see your plan, verify, e-sign, pay and go live. No branch visits, no couriers, no waiting for someone to call you back.</p>
          </Reveal>
          <div className="mt-10">
            <StepsCarousel />
          </div>
          <p className="mt-10 text-center text-sm text-ink-soft">
            Your documents are read once and never stored. <Link href="/privacy" className="font-medium underline underline-offset-4">How we handle your data</Link>
          </p>
        </div>
      </section>

      <NewsFlashes />

      <PlanDock lang={lang} />

      <SiteFooter />
    </div>
  );
}
