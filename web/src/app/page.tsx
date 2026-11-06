"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mic, MessageSquareText, Search } from "lucide-react";
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

export default function Home() {
  const [lang, setLang] = useState("hi");
  const [orderId, setOrderId] = useState("");
  const router = useRouter();
  const g = GREETING[lang] ?? GREETING.en;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-10">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <Link href="/console" className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline">
          Partner console
        </Link>
      </header>

      <nav aria-label="Language" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-pressed={lang === l.code}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[15px] transition-colors ${lang === l.code ? "border-ink bg-ink text-paper" : "border-rule bg-sheet text-ink hover:border-ink-soft"}`}
          >
            {l.native}
          </button>
        ))}
      </nav>

      <section className="mt-8 flex-1">
        <h1 lang={lang} className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-balance">
          {g.line}
        </h1>
        <p lang={lang} className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
          {g.sub}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            onClick={() => router.push(`/advisor?lang=${lang}&voice=1`)}
            className="group grid h-36 w-36 place-items-center rounded-full bg-marigold text-ink shadow-[0_10px_30px_-10px_var(--marigold-deep)] transition-transform active:scale-95"
            aria-label={g.talk}
          >
            <Mic size={56} strokeWidth={2.2} />
          </button>
          <div lang={lang} className="text-lg font-semibold">{g.talk}</div>
          <Link href={`/advisor?lang=${lang}`} lang={lang} className="inline-flex items-center gap-2 rounded-full border border-rule bg-sheet px-5 py-2.5 font-medium hover:border-ink-soft">
            <MessageSquareText size={18} /> {g.type}
          </Link>
          <Link href={`/whatsapp?lang=${lang}`} className="text-sm font-medium text-wa underline-offset-4 hover:underline">
            Or continue on WhatsApp
          </Link>
        </div>
      </section>

      <form
        className="mt-12 rounded-xl border border-rule bg-sheet p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (orderId.trim()) router.push(`/order/${orderId.trim().toUpperCase()}`);
        }}
      >
        <label htmlFor="track" className="text-sm font-semibold">Already ordered? Check your status</label>
        <div className="mt-2 flex gap-2">
          <input id="track" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID, e.g. ACC-3F9A2C71D0" className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 py-2 uppercase placeholder:normal-case" />
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-semibold text-paper"><Search size={16} /> Track</button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Your documents are read once and never stored. <Link href="/privacy" className="underline underline-offset-4">How we handle your data</Link>
      </p>
    </main>
  );
}
