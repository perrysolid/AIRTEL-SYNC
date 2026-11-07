"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle, Mic, MessageSquareText, Search, Send } from "lucide-react";
import { Shop3D, VISUAL_LABEL } from "@/components/shop/Shop3D";
import { Logo } from "@/components/Brand";
import { LANGUAGES } from "@/lib/advisor-types";

const GREETING: Record<string, { line: string; sub: string; talk: string; type: string }> = {
  en: { line: "Tell me about your shop. I'll set up the rest.", sub: "Internet, business numbers, WhatsApp, billing, CCTV — one plan, one bill, live in days.", talk: "Talk to the advisor", type: "Type instead" },
  hi: { line: "अपनी दुकान के बारे में बताइए। बाकी हम सेट कर देंगे।", sub: "इंटरनेट, बिज़नेस नंबर, WhatsApp, बिलिंग, CCTV — एक प्लान, एक बिल, कुछ ही दिनों में चालू।", talk: "सलाहकार से बात करें", type: "लिखकर बताएँ" },
  mr: { line: "तुमच्या व्यवसायाबद्दल सांगा. बाकी आम्ही करू.", sub: "इंटरनेट, बिझनेस नंबर, WhatsApp, बिलिंग, CCTV — एक प्लॅन, एक बिल.", talk: "सल्लागाराशी बोला", type: "टाइप करा" },
  ta: { line: "உங்கள் கடையைப் பற்றி சொல்லுங்கள். மீதியை நாங்கள் அமைக்கிறோம்.", sub: "இணையம், வணிக எண்கள், WhatsApp, பில்லிங், CCTV — ஒரே திட்டம், ஒரே பில்.", talk: "ஆலோசகரிடம் பேசுங்கள்", type: "தட்டச்சு செய்யுங்கள்" },
  te: { line: "మీ వ్యాపారం గురించి చెప్పండి. మిగతాది మేము చూసుకుంటాం.", sub: "ఇంటర్నెట్, బిజినెస్ నంబర్లు, WhatsApp, బిల్లింగ్, CCTV — ఒకే ప్లాన్, ఒకే బిల్.", talk: "సలహాదారుతో మాట్లాడండి", type: "టైప్ చేయండి" },
  kn: { line: "ನಿಮ್ಮ ವ್ಯಾಪಾರದ ಬಗ್ಗೆ ಹೇಳಿ. ಉಳಿದದ್ದು ನಾವು ಮಾಡುತ್ತೇವೆ.", sub: "ಇಂಟರ್ನೆಟ್, ಬಿಸಿನೆಸ್ ನಂಬರ್, WhatsApp, ಬಿಲ್ಲಿಂಗ್, CCTV — ಒಂದೇ ಪ್ಲಾನ್, ಒಂದೇ ಬಿಲ್.", talk: "ಸಲಹೆಗಾರರೊಂದಿಗೆ ಮಾತನಾಡಿ", type: "ಟೈಪ್ ಮಾಡಿ" },
  gu: { line: "તમારા વ્યવસાય વિશે કહો. બાકીનું અમે ગોઠવીશું.", sub: "ઇન્ટરનેટ, બિઝનેસ નંબર, WhatsApp, બિલિંગ, CCTV — એક પ્લાન, એક બિલ.", talk: "સલાહકાર સાથે વાત કરો", type: "ટાઇપ કરો" },
  bn: { line: "আপনার ব্যবসার কথা বলুন। বাকিটা আমরা করে দেব।", sub: "ইন্টারনেট, বিজনেস নম্বর, WhatsApp, বিলিং, CCTV — এক প্ল্যান, এক বিল।", talk: "পরামর্শদাতার সাথে কথা বলুন", type: "টাইপ করুন" },
  ml: { line: "നിങ്ങളുടെ ബിസിനസിനെക്കുറിച്ച് പറയൂ. ബാക്കി ഞങ്ങൾ ചെയ്യാം.", sub: "ഇന്റർനെറ്റ്, ബിസിനസ് നമ്പർ, WhatsApp, ബില്ലിംഗ്, CCTV — ഒരു പ്ലാൻ, ഒരു ബിൽ.", talk: "ഉപദേഷ്ടാവിനോട് സംസാരിക്കൂ", type: "ടൈപ്പ് ചെയ്യൂ" },
  pa: { line: "ਆਪਣੇ ਕਾਰੋਬਾਰ ਬਾਰੇ ਦੱਸੋ। ਬਾਕੀ ਅਸੀਂ ਕਰ ਦਿਆਂਗੇ।", sub: "ਇੰਟਰਨੈੱਟ, ਬਿਜ਼ਨਸ ਨੰਬਰ, WhatsApp, ਬਿਲਿੰਗ, CCTV — ਇੱਕ ਪਲਾਨ, ਇੱਕ ਬਿੱਲ।", talk: "ਸਲਾਹਕਾਰ ਨਾਲ ਗੱਲ ਕਰੋ", type: "ਟਾਈਪ ਕਰੋ" },
};

const SHOWCASE = ["P01", "P19", "P07", "P23", "P15", "P22", "P16", "P17"];
const TELEGRAM = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "UdyamAdvisorBot";

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

const STEPS = [
  ["Talk", "Say what your business does — in your language, by voice or chat."],
  ["See your plan", "One monthly price. Switch add-ons on or off yourself."],
  ["Verify in 2 minutes", "DigiLocker or photos. No visits, no couriers."],
  ["Go live", "SIMs today, internet in days. Updates on WhatsApp."],
];

export default function Home() {
  const [lang, setLang] = useState("hi");
  const [orderId, setOrderId] = useState("");
  const router = useRouter();
  const g = GREETING[lang] ?? GREETING.en;
  const items = useShowcase();
  const latest = items.at(-1);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-4 text-sm font-medium text-ink-soft">
          {[["Solutions", "/solutions"], ["Products", "/products"], ["How it works", "/how-it-works"], ["Scam Shield", "/shield"], ["Help", "/help"]].map(([l, h]) => (
            <Link key={h} href={h} className="hidden underline-offset-4 hover:underline lg:inline">{l}</Link>
          ))}
          <a href="#track" className="hidden underline-offset-4 hover:underline sm:inline">Track order</a>
          <Link href="/console" className="underline-offset-4 hover:underline">Partner console</Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-2 px-4 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-8">
        <div className="relative order-first h-[300px] sm:h-[380px] lg:order-last lg:h-[600px]">
          <Shop3D items={items} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center lg:bottom-10" aria-live="polite">
            {latest && (
              <span key={latest} className="chip-in inline-flex items-center gap-2 rounded-full border border-rule bg-sheet/90 px-3.5 py-1.5 text-sm font-semibold shadow-[var(--shadow-card)] backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-signal" /> {VISUAL_LABEL[latest]} connected
              </span>
            )}
          </div>
        </div>

        <section className="min-w-0">
          <nav aria-label="Language" className="rise no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2 lg:mx-0 lg:flex-wrap lg:px-0">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[15px] transition-all ${lang === l.code ? "border-ink bg-ink text-white shadow-[var(--shadow-card)]" : "border-rule bg-sheet text-ink hover:-translate-y-0.5 hover:border-ink-soft"}`}
              >
                {l.native}
              </button>
            ))}
          </nav>

          <h1 key={lang} lang={lang} className="rise mt-6 text-[2.5rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.6rem]" style={{ ["--i" as string]: 1 }}>
            {g.line}
          </h1>
          <p lang={lang} className="rise mt-4 max-w-lg text-lg leading-relaxed text-ink-soft" style={{ ["--i" as string]: 2 }}>
            {g.sub}
          </p>

          <div className="rise mt-8 flex flex-wrap items-center gap-4" style={{ ["--i" as string]: 3 }}>
            <button
              onClick={() => router.push(`/advisor?lang=${lang}&voice=1`)}
              className="group inline-flex items-center gap-3 rounded-full bg-marigold py-3 pr-6 pl-3 text-lg font-extrabold text-ink shadow-[0_14px_30px_-12px_var(--marigold-deep)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-marigold transition-transform group-hover:scale-105"><Mic size={24} strokeWidth={2.4} /></span>
              <span lang={lang}>{g.talk}</span>
            </button>
            <Link href={`/advisor?lang=${lang}`} lang={lang} className="inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-5 py-3 font-semibold shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
              <MessageSquareText size={18} /> {g.type}
            </Link>
          </div>
          <div className="rise mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" style={{ ["--i" as string]: 4 }}>
            <Link href={`/whatsapp?lang=${lang}`} className="inline-flex items-center gap-1.5 text-wa underline-offset-4 hover:underline">
              <MessageCircle size={16} /> Continue on WhatsApp
            </Link>
            <a href={`https://t.me/${TELEGRAM}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#1f8ccf] underline-offset-4 hover:underline">
              <Send size={16} /> Chat on Telegram
            </a>
          </div>

          <form
            className="rise card mt-10 max-w-lg p-4"
            style={{ ["--i" as string]: 5 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (orderId.trim()) router.push(`/order/${orderId.trim().toUpperCase()}`);
            }}
          >
            <label htmlFor="track" className="text-sm font-semibold">Already ordered? Check your status</label>
            <div className="mt-2 flex gap-2">
              <input id="track" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID, e.g. ACC-3F9A2C71D0" className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2.5 uppercase placeholder:normal-case" />
              <button className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 font-semibold text-white"><Search size={16} /> Track</button>
            </div>
          </form>
        </section>
      </main>

      <section aria-labelledby="tools" className="border-t border-rule">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="tools" className="text-2xl font-extrabold tracking-tight">Beyond the sale: tools that keep your business running</h2>
          <p className="mt-1 max-w-2xl text-ink-soft">Free to try, no sign-up. They also work as commands in WhatsApp and Telegram.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["🛡️", "Scam Shield", "Forward a suspicious message, link or payment screenshot. Get a verdict, the red flags and what to do next.", "/shield"],
              ["📡", "Network Reality Check", "Know what can be installed at your pincode before you pay. No fibre? We switch you to 5G AirFiber.", "/network"],
              ["💓", "Health & backup", "Service status, automatic tickets with an SLA, and a backup link that keeps your billing running.", "/solutions"],
              ["📅", "Installation slots", "Book and reschedule the technician visit yourself. Two free reschedules, no phone calls.", "/help"],
              ["🏪", "Branch-in-a-Box", "Opening a second shop? Copy your setup, reuse your KYC and book the install in one tap.", "/solutions"],
              ["💬", "Everything in chat", "SHIELD, NETWORK, SCHEDULE, TROUBLE, BRANCH and BACKUP work in WhatsApp and Telegram.", "/whatsapp"],
            ].map(([icon, title, text, href]) => (
              <li key={title}>
                <Link href={href} className="card flex h-full flex-col gap-1 p-5 transition-transform hover:-translate-y-0.5">
                  <span className="text-3xl" aria-hidden>{icon}</span>
                  <h3 className="mt-1 text-lg font-bold">{title}</h3>
                  <p className="text-ink-soft">{text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how" className="border-t border-rule bg-sheet/70">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="how" className="text-2xl font-extrabold tracking-tight">From hello to live, without a single follow-up call</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="card p-5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-bold text-marigold">{i + 1}</div>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-ink-soft">
            Your documents are read once and never stored. <Link href="/privacy" className="font-medium underline underline-offset-4">How we handle your data</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
