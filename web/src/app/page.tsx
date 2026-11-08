"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mic, MessageSquareText, Search } from "lucide-react";
import { Shop3D, VISUAL_LABEL } from "@/components/shop/Shop3D";
import { Logo } from "@/components/Brand";
import { HeroMenu } from "@/components/HeroMenu";
import { NetworkBackdrop } from "@/components/NetworkBackdrop";
import { PhoneMock } from "@/components/PhoneMock";
import { PromoBar } from "@/components/SiteNav";

const GREETING: Record<string, { line: string; sub: string; talk: string; type: string }> = {
  en: { line: "Keep the payment beep coming.", sub: "Internet, business numbers, billing and CCTV for your shop, in one plan and one bill. Set up by chat, in your language, live in days.", talk: "Talk to the advisor", type: "Type instead" },
  hi: { line: "बजती रहे, पेमेंट की आवाज़।", sub: "दुकान के लिए इंटरनेट, बिज़नेस नंबर, बिलिंग और CCTV — एक प्लान, एक बिल। अपनी भाषा में चैट से सेटअप, कुछ ही दिनों में चालू।", talk: "सलाहकार से बात करें", type: "लिखकर बताएँ" },
  mr: { line: "पेमेंटचा आवाज येत राहो.", sub: "दुकानासाठी इंटरनेट, बिझनेस नंबर, बिलिंग आणि CCTV — एक प्लॅन, एक बिल. तुमच्या भाषेत चॅटवरून सेटअप.", talk: "सल्लागाराशी बोला", type: "टाइप करा" },
  ta: { line: "பணம் வந்த ஒலி நிற்காமல் ஒலிக்கட்டும்.", sub: "உங்கள் கடைக்கு இணையம், வணிக எண்கள், பில்லிங், CCTV — ஒரே திட்டம், ஒரே பில். உங்கள் மொழியில் சாட் மூலம் அமைப்பு.", talk: "ஆலோசகரிடம் பேசுங்கள்", type: "தட்டச்சு செய்யுங்கள்" },
  te: { line: "పేమెంట్ శబ్దం ఆగకుండా వినిపించాలి.", sub: "మీ షాపు కోసం ఇంటర్నెట్, బిజినెస్ నంబర్లు, బిల్లింగ్, CCTV — ఒకే ప్లాన్, ఒకే బిల్. మీ భాషలో చాట్ ద్వారా సెటప్.", talk: "సలహాదారుతో మాట్లాడండి", type: "టైప్ చేయండి" },
  kn: { line: "ಪೇಮೆಂಟ್ ಸದ್ದು ನಿಲ್ಲದೆ ಕೇಳಿಸುತ್ತಿರಲಿ.", sub: "ನಿಮ್ಮ ಅಂಗಡಿಗೆ ಇಂಟರ್ನೆಟ್, ಬಿಸಿನೆಸ್ ನಂಬರ್, ಬಿಲ್ಲಿಂಗ್, CCTV — ಒಂದೇ ಪ್ಲಾನ್, ಒಂದೇ ಬಿಲ್. ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಚಾಟ್ ಮೂಲಕ ಸೆಟಪ್.", talk: "ಸಲಹೆಗಾರರೊಂದಿಗೆ ಮಾತನಾಡಿ", type: "ಟೈಪ್ ಮಾಡಿ" },
  gu: { line: "પેમેન્ટનો અવાજ સતત આવતો રહે.", sub: "તમારી દુકાન માટે ઇન્ટરનેટ, બિઝનેસ નંબર, બિલિંગ અને CCTV — એક પ્લાન, એક બિલ. તમારી ભાષામાં ચેટથી સેટઅપ.", talk: "સલાહકાર સાથે વાત કરો", type: "ટાઇપ કરો" },
  bn: { line: "পেমেন্টের আওয়াজ চলতেই থাকুক।", sub: "আপনার দোকানের জন্য ইন্টারনেট, বিজনেস নম্বর, বিলিং ও CCTV — এক প্ল্যান, এক বিল। নিজের ভাষায় চ্যাটে সেটআপ।", talk: "পরামর্শদাতার সাথে কথা বলুন", type: "টাইপ করুন" },
  ml: { line: "പേയ്‌മെന്റ് ശബ്ദം നിലയ്ക്കാതിരിക്കട്ടെ.", sub: "നിങ്ങളുടെ കടയ്ക്ക് ഇന്റർനെറ്റ്, ബിസിനസ് നമ്പർ, ബില്ലിംഗ്, CCTV — ഒരു പ്ലാൻ, ഒരു ബിൽ. നിങ്ങളുടെ ഭാഷയിൽ ചാറ്റ് വഴി സെറ്റപ്പ്.", talk: "ഉപദേഷ്ടാവിനോട് സംസാരിക്കൂ", type: "ടൈപ്പ് ചെയ്യൂ" },
  pa: { line: "ਪੇਮੈਂਟ ਦੀ ਆਵਾਜ਼ ਵੱਜਦੀ ਰਹੇ।", sub: "ਤੁਹਾਡੀ ਦੁਕਾਨ ਲਈ ਇੰਟਰਨੈੱਟ, ਬਿਜ਼ਨਸ ਨੰਬਰ, ਬਿਲਿੰਗ ਅਤੇ CCTV — ਇੱਕ ਪਲਾਨ, ਇੱਕ ਬਿੱਲ। ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਚੈਟ ਰਾਹੀਂ ਸੈੱਟਅੱਪ।", talk: "ਸਲਾਹਕਾਰ ਨਾਲ ਗੱਲ ਕਰੋ", type: "ਟਾਈਪ ਕਰੋ" },
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

export default function Home() {
  const [lang, setLang] = useState("en");
  const [orderId, setOrderId] = useState("");
  const router = useRouter();
  const g = GREETING[lang] ?? GREETING.en;
  const items = useShowcase();
  const latest = items.at(-1);

  return (
    <div className="min-h-dvh">
      <PromoBar />

      {/* ------------------------------------------------------------------ hero: a live network, one line, three phones on a stage */}
      <section className="relative isolate flex min-h-[calc(100dvh-2rem)] flex-col overflow-hidden bg-[#050a1c] text-white">
        <NetworkBackdrop className="absolute inset-0 -z-20" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#050a1c]/70 via-[#050a1c]/20 to-[#050a1c]/80" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(48rem_20rem_at_50%_52%,rgb(5_10_28/0.8),transparent_72%)]" />

        {/* the two corners: brand on the left, menu on the right, on the same baseline and the same inset */}
        <header className="flex h-[4.5rem] w-full items-center justify-between px-[clamp(1rem,3vw,2.75rem)]">
          <Logo onDark />
          <HeroMenu lang={lang} onLang={setLang} telegram={TELEGRAM} />
        </header>

        {/* the message sits in the middle, just above the stage; the background does the rest of the talking */}
        <div className="flex flex-1 flex-col items-center justify-end px-4 pb-[clamp(1.25rem,4.5dvh,3rem)] text-center">
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
        </div>

        {/* ----------------------------------------------- the stage: a low white arc, three phones standing on it, sized from one number */}
        <div
          role="group"
          aria-label="The product on a phone"
          className="relative mx-auto w-full flex-none"
          style={{ ["--ph" as string]: "min(40dvh, 62vw, 400px)", height: "calc(var(--ph) * 0.86)" }}
        >
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(255_255_255/0.55),0_-8px_60px_rgb(228_0_0/0.35)]"
            style={{ top: "calc(var(--ph) * 0.34)", width: "calc(var(--ph) * 2.4)", height: "calc(var(--ph) * 2.4)" }}
          />
          <div className="absolute inset-x-0 flex items-end justify-center" style={{ bottom: "calc(var(--ph) * -0.14)", gap: "calc(var(--ph) * 0.07)" }}>
            <div className="phone-in" style={{ ["--i" as string]: 1, ["--r" as string]: "-7deg", rotate: "-7deg", height: "calc(var(--ph) * 0.8)", transform: "translateY(calc(var(--ph) * 0.02))" }}>
              <PhoneMock className="h-full" src="/screens/advisor.png" alt="The advisor recommends a bundle with a clear monthly price" />
            </div>
            <div className="phone-in z-10" style={{ ["--i" as string]: 0, height: "var(--ph)" }}>
              <PhoneMock className="h-full" src="/screens/quote.png" alt="The quote: a live 3D shop, the plan and one monthly price" />
            </div>
            <div className="phone-in" style={{ ["--i" as string]: 2, ["--r" as string]: "7deg", rotate: "7deg", height: "calc(var(--ph) * 0.8)", transform: "translateY(calc(var(--ph) * 0.02))" }}>
              <PhoneMock className="h-full" src="/screens/shield.png" alt="Scam Shield flags a fake KYC message and says what to do" />
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
