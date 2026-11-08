"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle, Mic, Search, Send, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Brand";
import { Hero, TELEGRAM } from "@/components/home/Hero";
import { Journey } from "@/components/home/Journey";
import { ForTeams, Money, Stories } from "@/components/home/Sections";

/** Transparent over the dark hero, solid white once the page scrolls. */
function Header() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-30 transition-colors duration-300 ${solid ? "border-b border-rule bg-sheet/85 backdrop-blur-md" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className={solid ? "" : "[&_span]:!text-white [&_span_span]:!text-white/70"}>
          <Logo />
        </div>
        <nav className={`flex items-center gap-5 text-[15px] font-semibold ${solid ? "text-ink-soft" : "text-white/80"}`}>
          <a href="#track" className="hidden underline-offset-4 hover:underline sm:inline">Track order</a>
          <Link href="/sales" className="underline-offset-4 hover:underline">Sales portal</Link>
        </nav>
      </div>
    </header>
  );
}

export default function Home() {
  const [lang, setLang] = useState("hi");
  const [orderId, setOrderId] = useState("");
  const router = useRouter();

  return (
    <div className="min-h-dvh">
      <Header />
      <main>
        <Hero lang={lang} setLang={setLang} />
        <Journey />
        <Money />
        <ForTeams />
        <Stories />

        <section aria-labelledby="start" className="bg-paper">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-20 md:grid-cols-3">
            <h2 id="start" className="text-4xl font-extrabold md:col-span-3">Start wherever you already are</h2>
            <Link href={`/advisor?lang=${lang}&voice=1`} className="card group p-6 transition-transform duration-300 hover:-translate-y-1">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white transition-transform group-hover:scale-110"><Mic size={22} /></span>
              <h3 className="mt-4 text-xl font-bold">Speak to the advisor</h3>
              <p className="mt-1 text-ink-soft">Ten Indian languages, voice in and voice out, right in your browser.</p>
            </Link>
            <Link href={`/whatsapp?lang=${lang}`} className="card group p-6 transition-transform duration-300 hover:-translate-y-1">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#25d366] text-white transition-transform group-hover:scale-110"><MessageCircle size={22} /></span>
              <h3 className="mt-4 text-xl font-bold">WhatsApp</h3>
              <p className="mt-1 text-ink-soft">Plan cards, order buttons and live status pictures in the chat you use all day.</p>
            </Link>
            <a href={`https://t.me/${TELEGRAM}`} target="_blank" rel="noreferrer" className="card group p-6 transition-transform duration-300 hover:-translate-y-1">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#229ed9] text-white transition-transform group-hover:scale-110"><Send size={22} /></span>
              <h3 className="mt-4 text-xl font-bold">Telegram</h3>
              <p className="mt-1 text-ink-soft">The same advisor and updates, with tap-to-share your number.</p>
            </a>

            <form
              id="track"
              className="night mt-4 rounded-[28px] p-6 md:col-span-3 md:flex md:items-center md:justify-between md:gap-8 md:p-8"
              onSubmit={(e) => {
                e.preventDefault();
                if (orderId.trim()) router.push(`/order/${orderId.trim().toUpperCase()}`);
              }}
            >
              <div>
                <label htmlFor="track-id" className="text-2xl font-bold">Already ordered? See exactly where it is</label>
                <p className="mt-1 text-white/70">Your order ID is in the first WhatsApp message we sent.</p>
              </div>
              <div className="mt-4 flex w-full gap-2 md:mt-0 md:max-w-md">
                <input id="track-id" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ACC-3F9A2C71D0" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white uppercase placeholder:text-white/40 placeholder:normal-case" />
                <button className="btn-primary inline-flex items-center gap-2 px-5"><Search size={17} /> Track</button>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-sheet">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-soft">
          <Logo small />
          <p className="flex items-center gap-2"><ShieldCheck size={16} className="text-ok" /> Documents are read once and never stored. <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">How we handle your data</Link></p>
        </div>
      </footer>
    </div>
  );
}
