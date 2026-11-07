"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle, Mic, MessageSquareText, Search, Send } from "lucide-react";
import { Shop3D, VISUAL_LABEL } from "@/components/shop/Shop3D";
import { Logo } from "@/components/Brand";
import { HeroScene } from "@/components/HeroScene";
import { PhoneMock } from "@/components/PhoneMock";
import { PromoBar } from "@/components/SiteNav";
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

const TOOLS: [string, string, string, string][] = [
  ["🛡️", "Scam Shield", "Forward a suspicious message, link or payment screenshot. Get a verdict, the red flags and what to do next.", "/shield"],
  ["📡", "Network Reality Check", "Know what can be installed at your pincode before you pay. No fibre? We switch you to 5G AirFiber.", "/network"],
  ["💓", "Health & backup", "Service status, automatic tickets with an SLA, and a backup link that keeps your billing running.", "/solutions"],
  ["📅", "Installation slots", "Book and reschedule the technician visit yourself. Two free reschedules, no phone calls.", "/help"],
  ["🏪", "Branch-in-a-Box", "Opening a second shop? Copy your setup, reuse your KYC and book the install in one tap.", "/solutions"],
  ["💬", "Everything in chat", "SHIELD, NETWORK, SCHEDULE, TROUBLE, BRANCH and BACKUP work in WhatsApp and Telegram.", "/whatsapp"],
];

const NAV: [string, string][] = [["Solutions", "/solutions"], ["Products", "/products"], ["How it works", "/how-it-works"], ["Scam Shield", "/shield"], ["Help", "/help"]];

export default function Home() {
  const [lang, setLang] = useState("hi");
  const [orderId, setOrderId] = useState("");
  const router = useRouter();
  const g = GREETING[lang] ?? GREETING.en;
  const items = useShowcase();
  const latest = items.at(-1);

  return (
    <div className="min-h-dvh">
      <PromoBar />

      {/* ------------------------------------------------------------------ hero: a connected city at night */}
      <section className="relative isolate flex min-h-[calc(100dvh-2rem)] flex-col overflow-hidden bg-[#060914] text-white">
        <HeroScene className="absolute inset-0 -z-20 h-full w-full" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#060914]/80 via-[#060914]/35 to-[#060914]/80" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_26rem_at_50%_38%,rgb(6_9_20/0.72),transparent_70%)]" />

        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Logo onDark />
          <nav aria-label="Main" className="flex items-center gap-5 text-sm font-semibold text-white/80">
            {NAV.map(([l, h]) => <Link key={h} href={h} className="hidden hover:text-white lg:inline">{l}</Link>)}
            <a href="#track" className="hidden hover:text-white sm:inline">Track order</a>
            <Link href="/console" className="rounded-full border border-white/30 px-3.5 py-1.5 hover:bg-white/10">Partner console</Link>
          </nav>
        </header>

        <div className="mx-auto w-full max-w-4xl flex-none px-4 pt-3 text-center sm:pt-[2.6dvh]">
          <nav aria-label="Language" className="rise no-scrollbar -mx-4 flex justify-start gap-2 overflow-x-auto px-4 py-1 sm:justify-center sm:overflow-visible sm:flex-wrap">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
                className={`shrink-0 rounded-full border px-3.5 py-1 text-[15px] backdrop-blur transition-all ${lang === l.code ? "border-brand bg-brand text-white shadow-[0_10px_24px_-10px_var(--brand)]" : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20"}`}
              >
                {l.native}
              </button>
            ))}
          </nav>

          <h1 key={lang} lang={lang} className="rise mt-[2.4dvh] text-[clamp(1.75rem,5.4dvh,3.4rem)] leading-[1.1] font-extrabold tracking-tight text-balance [text-shadow:0_2px_30px_rgb(0_0_0/0.6)]" style={{ ["--i" as string]: 1 }}>
            {g.line}
          </h1>
          <p lang={lang} className="rise mx-auto mt-[1.6dvh] max-w-2xl text-[clamp(0.95rem,2.3dvh,1.15rem)] leading-snug text-white/85 [text-shadow:0_1px_18px_rgb(0_0_0/0.6)]" style={{ ["--i" as string]: 2 }}>
            {g.sub}
          </p>

          <div className="rise mt-[2.8dvh] flex flex-wrap items-center justify-center gap-3" style={{ ["--i" as string]: 3 }}>
            <button
              onClick={() => router.push(`/advisor?lang=${lang}&voice=1`)}
              className="group inline-flex items-center gap-3 rounded-full bg-brand py-2 pr-5 pl-2 text-base font-extrabold text-white shadow-[0_16px_36px_-12px_var(--brand)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand transition-transform group-hover:scale-105"><Mic size={20} strokeWidth={2.4} /></span>
              <span lang={lang}>{g.talk}</span>
            </button>
            <Link href={`/advisor?lang=${lang}`} lang={lang} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-[15px] font-semibold text-white backdrop-blur transition-transform hover:-translate-y-0.5 hover:bg-white/20">
              <MessageSquareText size={18} /> {g.type}
            </Link>
          </div>
          <div className="rise mt-[1.8dvh] flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm font-semibold" style={{ ["--i" as string]: 4 }}>
            <Link href={`/whatsapp?lang=${lang}`} className="inline-flex items-center gap-1.5 text-[#7be0b4] underline-offset-4 hover:underline"><MessageCircle size={16} /> Continue on WhatsApp</Link>
            <a href={`https://t.me/${TELEGRAM}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#8fd3ff] underline-offset-4 hover:underline"><Send size={16} /> Chat on Telegram</a>
          </div>
        </div>

        {/* ----------------------------------------------- the stage: a semicircle with three phones standing on its border */}
        <div role="group" aria-label="The product on a phone" className="relative mt-auto h-[clamp(215px,38dvh,400px)] w-full flex-none">
          <div aria-hidden className="absolute top-[calc(38%-18px)] left-1/2 aspect-square w-[calc(min(135vw,1500px)+36px)] -translate-x-1/2 rounded-full border border-white/40 shadow-[0_0_70px_rgb(228_0_0/0.45)]" />
          <div aria-hidden className="absolute top-[38%] left-1/2 aspect-square w-[min(135vw,1500px)] -translate-x-1/2 rounded-full bg-white" />
          <div className="absolute inset-x-0 bottom-[7%] flex items-end justify-center gap-[clamp(8px,2.4vw,30px)]">
            <div className="phone-in w-[min(25vw,clamp(86px,12.6dvh,128px))] translate-y-[7%]" style={{ ["--i" as string]: 1, ["--r" as string]: "-8deg", rotate: "-8deg" }}>
              <PhoneMock src="/screens/advisor.png" alt="The advisor recommends a bundle with a clear monthly price" />
            </div>
            <div className="phone-in z-10 w-[min(29vw,clamp(100px,15dvh,150px))]" style={{ ["--i" as string]: 0 }}>
              <PhoneMock src="/screens/quote.png" alt="The quote: a live 3D shop, the plan and one monthly price" />
            </div>
            <div className="phone-in w-[min(25vw,clamp(86px,12.6dvh,128px))] translate-y-[7%]" style={{ ["--i" as string]: 2, ["--r" as string]: "8deg", rotate: "8deg" }}>
              <PhoneMock src="/screens/shield.png" alt="Scam Shield flags a fake KYC message and says what to do" />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ the 3D shop that builds itself + order tracking */}
      <main className="mx-auto mt-4 grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-6 px-4 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
        <section className="min-w-0">
          <span aria-hidden className="mb-3 block h-1 w-12 rounded-full bg-brand" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Watch your shop come alive, one service at a time</h2>
          <p className="mt-3 max-w-lg text-lg text-ink-soft">Every product in your plan shows up on your shop as the advisor adds it. Then, on the tracker, each one turns from setting-up to live.</p>
          <form
            id="track"
            className="card mt-8 max-w-lg scroll-mt-24 p-4"
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
        </section>
        <div className="relative h-[300px] sm:h-[380px] lg:h-[480px]">
          <Shop3D items={items} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center" aria-live="polite">
            {latest && (
              <span key={latest} className="chip-in inline-flex items-center gap-2 rounded-full border border-rule bg-sheet/90 px-3.5 py-1.5 text-sm font-semibold shadow-[var(--shadow-card)] backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-signal" /> {VISUAL_LABEL[latest]} connected
              </span>
            )}
          </div>
        </div>
      </main>

      <section aria-labelledby="tools" className="border-y border-brand/15 bg-brand-soft">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <span aria-hidden className="mb-3 block h-1 w-12 rounded-full bg-brand" />
          <h2 id="tools" className="text-2xl font-extrabold tracking-tight">Beyond the sale: tools that keep your business running</h2>
          <p className="mt-1 max-w-2xl text-ink-soft">Free to try, no sign-up. They also work as commands in WhatsApp and Telegram.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(([icon, title, text, href]) => (
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

      <section aria-labelledby="how" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <span aria-hidden className="mb-3 block h-1 w-12 rounded-full bg-brand" />
          <h2 id="how" className="text-2xl font-extrabold tracking-tight">From hello to live, without a single follow-up call</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="card p-5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</div>
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
