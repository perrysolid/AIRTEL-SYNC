"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, MessageCircle, MessageSquareText, Mic, Send } from "lucide-react";
import { Shop3D, VISUAL_LABEL } from "@/components/shop/Shop3D";
import { LANGUAGES } from "@/lib/advisor-types";

export const GREETING: Record<string, { line: string; sub: string; talk: string; type: string }> = {
  en: { line: "Tell us about your shop. We'll connect the rest.", sub: "Internet, business numbers, WhatsApp, billing, CCTV — one plan, one bill, live in days.", talk: "Talk to the advisor", type: "Type instead" },
  hi: { line: "अपनी दुकान के बारे में बताइए। बाकी हम जोड़ देंगे।", sub: "इंटरनेट, बिज़नेस नंबर, WhatsApp, बिलिंग, CCTV — एक प्लान, एक बिल, कुछ ही दिनों में चालू।", talk: "सलाहकार से बात करें", type: "लिखकर बताएँ" },
  mr: { line: "तुमच्या व्यवसायाबद्दल सांगा. बाकी आम्ही जोडू.", sub: "इंटरनेट, बिझनेस नंबर, WhatsApp, बिलिंग, CCTV — एक प्लॅन, एक बिल.", talk: "सल्लागाराशी बोला", type: "टाइप करा" },
  ta: { line: "உங்கள் கடையைப் பற்றி சொல்லுங்கள். மீதியை நாங்கள் இணைக்கிறோம்.", sub: "இணையம், வணிக எண்கள், WhatsApp, பில்லிங், CCTV — ஒரே திட்டம், ஒரே பில்.", talk: "ஆலோசகரிடம் பேசுங்கள்", type: "தட்டச்சு செய்யுங்கள்" },
  te: { line: "మీ వ్యాపారం గురించి చెప్పండి. మిగతాది మేము కలుపుతాం.", sub: "ఇంటర్నెట్, బిజినెస్ నంబర్లు, WhatsApp, బిల్లింగ్, CCTV — ఒకే ప్లాన్, ఒకే బిల్.", talk: "సలహాదారుతో మాట్లాడండి", type: "టైప్ చేయండి" },
  kn: { line: "ನಿಮ್ಮ ವ್ಯಾಪಾರದ ಬಗ್ಗೆ ಹೇಳಿ. ಉಳಿದದ್ದು ನಾವು ಜೋಡಿಸುತ್ತೇವೆ.", sub: "ಇಂಟರ್ನೆಟ್, ಬಿಸಿನೆಸ್ ನಂಬರ್, WhatsApp, ಬಿಲ್ಲಿಂಗ್, CCTV — ಒಂದೇ ಪ್ಲಾನ್, ಒಂದೇ ಬಿಲ್.", talk: "ಸಲಹೆಗಾರರೊಂದಿಗೆ ಮಾತನಾಡಿ", type: "ಟೈಪ್ ಮಾಡಿ" },
  gu: { line: "તમારા વ્યવસાય વિશે કહો. બાકીનું અમે જોડીશું.", sub: "ઇન્ટરનેટ, બિઝનેસ નંબર, WhatsApp, બિલિંગ, CCTV — એક પ્લાન, એક બિલ.", talk: "સલાહકાર સાથે વાત કરો", type: "ટાઇપ કરો" },
  bn: { line: "আপনার ব্যবসার কথা বলুন। বাকিটা আমরা জুড়ে দেব।", sub: "ইন্টারনেট, বিজনেস নম্বর, WhatsApp, বিলিং, CCTV — এক প্ল্যান, এক বিল।", talk: "পরামর্শদাতার সাথে কথা বলুন", type: "টাইপ করুন" },
  ml: { line: "നിങ്ങളുടെ ബിസിനസിനെക്കുറിച്ച് പറയൂ. ബാക്കി ഞങ്ങൾ ബന്ധിപ്പിക്കാം.", sub: "ഇന്റർനെറ്റ്, ബിസിനസ് നമ്പർ, WhatsApp, ബില്ലിംഗ്, CCTV — ഒരു പ്ലാൻ, ഒരു ബിൽ.", talk: "ഉപദേഷ്ടാവിനോട് സംസാരിക്കൂ", type: "ടൈപ്പ് ചെയ്യൂ" },
  pa: { line: "ਆਪਣੇ ਕਾਰੋਬਾਰ ਬਾਰੇ ਦੱਸੋ। ਬਾਕੀ ਅਸੀਂ ਜੋੜ ਦਿਆਂਗੇ।", sub: "ਇੰਟਰਨੈੱਟ, ਬਿਜ਼ਨਸ ਨੰਬਰ, WhatsApp, ਬਿਲਿੰਗ, CCTV — ਇੱਕ ਪਲਾਨ, ਇੱਕ ਬਿੱਲ।", talk: "ਸਲਾਹਕਾਰ ਨਾਲ ਗੱਲ ਕਰੋ", type: "ਟਾਈਪ ਕਰੋ" },
};

const SHOWCASE = ["P01", "P19", "P07", "P23", "P15", "P22", "P16", "P17"];
export const TELEGRAM = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "UdyamAdvisorBot";

/** Builds a sample plan onto the 3D shop, one product at a time, then starts over. */
function useShowcase() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(SHOWCASE.length);
    const t = setInterval(() => setN((k) => (k >= SHOWCASE.length + 3 ? 0 : k + 1)), 1100);
    return () => clearInterval(t);
  }, []);
  return SHOWCASE.slice(0, Math.min(n, SHOWCASE.length));
}

/** Small glass cards that drift around the shop: what the owner will see on their phone. */
function Floater({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`glass pointer-events-none absolute hidden rounded-2xl px-3.5 py-2.5 text-sm text-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.6)] sm:block ${className}`}
      initial={reduce ? false : { opacity: 0, y: 24, scale: 0.9 }}
      animate={reduce ? undefined : { opacity: 1, y: [0, -10, 0], scale: 1 }}
      transition={{ opacity: { delay, duration: 0.6 }, scale: { delay, duration: 0.6 }, y: { delay: delay + 0.6, duration: 5, repeat: Infinity, ease: "easeInOut" } }}
    >
      {children}
    </motion.div>
  );
}

export function Hero({ lang, setLang }: { lang: string; setLang: (l: string) => void }) {
  const router = useRouter();
  const g = GREETING[lang] ?? GREETING.en;
  const items = useShowcase();
  const latest = items.at(-1);
  const reduce = useReducedMotion();

  return (
    <section className="night relative overflow-hidden">
      <div aria-hidden className="grid-floor absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-24 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-6 lg:pt-28 lg:pb-24">
        <div className="relative order-first h-[320px] sm:h-[420px] lg:order-last lg:h-[600px]">
          <Shop3D items={items} glow className="absolute inset-0" />
          <Floater className="top-[8%] left-[2%]" delay={0.8}>
            <div className="text-white/60">Your plan</div>
            <div className="text-lg font-bold tabular-nums">₹4,028<span className="text-sm font-medium text-white/60"> /month incl. GST</span></div>
          </Floater>
          <Floater className="top-[14%] right-[0%]" delay={1.4}>
            <div className="flex items-center gap-2 font-semibold"><BadgeCheck size={18} className="text-signal" /> Business verified</div>
            <div className="text-white/60">GSTIN and Udyam matched in 1m 52s</div>
          </Floater>
          <Floater className="bottom-[16%] left-[0%]" delay={2}>
            <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#25d366]"><MessageCircle size={14} /></span><span className="font-semibold">WhatsApp</span></div>
            <div className="mt-0.5 text-white/80">✅ Your 2 business SIMs are live</div>
          </Floater>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center" aria-live="polite">
            <AnimatePresence mode="popLayout">
              {latest && (
                <motion.span
                  key={latest}
                  initial={reduce ? false : { opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink shadow-[var(--shadow-lift)]"
                >
                  <span className="live-dot h-2 w-2 rounded-full bg-signal" /> {VISUAL_LABEL[latest]} connected
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="min-w-0">
          <nav aria-label="Language" className="rise no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 lg:mx-0 lg:flex-wrap lg:px-0">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[15px] transition-all duration-200 ${lang === l.code ? "bg-white font-semibold text-ink" : "glass text-white/85 hover:bg-white/15"}`}
              >
                {l.native}
              </button>
            ))}
          </nav>

          <AnimatePresence mode="wait">
            <motion.h1
              key={lang}
              lang={lang}
              initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="mt-7 text-[2.6rem] font-extrabold text-balance sm:text-6xl lg:text-[4.1rem]"
            >
              {g.line}
            </motion.h1>
          </AnimatePresence>
          <p lang={lang} className="rise mt-5 max-w-lg text-lg leading-relaxed text-white/75" style={{ ["--i" as string]: 2 }}>
            {g.sub}
          </p>

          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 3 }}>
            <button onClick={() => router.push(`/advisor?lang=${lang}&voice=1`)} className="btn-primary group inline-flex items-center gap-3 rounded-full py-2.5 pr-6 pl-2.5 text-lg">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand transition-transform duration-300 group-hover:scale-110">
                <Mic size={22} strokeWidth={2.4} />
              </span>
              <span lang={lang}>{g.talk}</span>
            </button>
            <Link href={`/advisor?lang=${lang}`} lang={lang} className="glass inline-flex items-center gap-2 rounded-full px-5 py-3.5 font-semibold text-white transition-colors hover:bg-white/15">
              <MessageSquareText size={18} /> {g.type}
            </Link>
          </div>
          <div className="rise mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-semibold" style={{ ["--i" as string]: 4 }}>
            <Link href={`/whatsapp?lang=${lang}`} className="inline-flex items-center gap-2 text-[#5ee39a] underline-offset-4 hover:underline">
              <MessageCircle size={17} /> Continue on WhatsApp
            </Link>
            <a href={`https://t.me/${TELEGRAM}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#6cc4ff] underline-offset-4 hover:underline">
              <Send size={17} /> Chat on Telegram
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
