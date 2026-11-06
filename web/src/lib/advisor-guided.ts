import { product } from "./catalogue";
import { buildQuote } from "./pricing";
import { inferSegment, NEED_LABELS, tierForCity, type Need, type Profile } from "./profile";
import { recommend } from "./recommend";
import { profileFromGstin } from "./registry";
import { mergeParsed, parseUtterance } from "./nlu";
import { inr } from "./format";
import type { AdvisorEvent, Chip } from "./advisor-types";
import type { AdvisorSession } from "./store";

/**
 * Guided advisor: a deterministic, bilingual (en/hi) conversation that works
 * with no LLM. It still understands free text through the NLU pre-pass, so an
 * owner can say everything in one sentence and skip questions.
 */

type Lang = "en" | "hi";

const T = {
  hello: {
    en: "Namaste! I'm Udyam, Accel's business advisor. I'll suggest the right internet, phone and digital tools for your business in about a minute.\n\nHave your GSTIN handy? Type it and I'll fill most details for you. Otherwise, what kind of business do you run?",
    hi: "नमस्ते! मैं उद्यम हूँ, Accel का बिज़नेस सलाहकार। एक मिनट में मैं आपके बिज़नेस के लिए सही इंटरनेट, फ़ोन और डिजिटल टूल सुझाऊँगा।\n\nGSTIN है? लिख दीजिए, ज़्यादातर जानकारी मैं खुद भर दूँगा। नहीं तो बताइए, आपका बिज़नेस क्या है?",
  },
  city: { en: "Which city is your business in?", hi: "आपका बिज़नेस किस शहर में है?" },
  employees: { en: "How many people work there, including you?", hi: "आपको मिलाकर वहाँ कितने लोग काम करते हैं?" },
  sites: { en: "How many locations (shops/branches) do you have?", hi: "आपकी कितनी ब्रांच या दुकानें हैं?" },
  gst: { en: "Is your business registered for GST?", hi: "क्या आपका बिज़नेस GST में रजिस्टर्ड है?" },
  needs: {
    en: "What would help your business most? Pick all that apply.",
    hi: "आपके बिज़नेस के लिए क्या सबसे ज़रूरी है? जितने चाहें चुनें।",
  },
  gstFound: {
    en: (name: string, city: string, status: string) => `Found it: **${name}**, ${city}. GST status: ${status}. I've filled in what I could.`,
    hi: (name: string, city: string, status: string) => `मिल गया: **${name}**, ${city}। GST स्थिति: ${status}। जो जानकारी मिली, मैंने भर दी है।`,
  },
  gstNotFound: {
    en: "I couldn't find that GSTIN in the registry. Please check it — or tell me about your business instead.",
    hi: "यह GSTIN रजिस्ट्री में नहीं मिला। कृपया जाँच लें — या अपने बिज़नेस के बारे में बताइए।",
  },
  notServed: {
    en: (c: string) => `We don't offer business connections in ${c} yet. I can note your interest and a partner will call when we launch. Want to continue anyway to see prices?`,
    hi: (c: string) => `${c} में अभी हमारी बिज़नेस सेवा नहीं है। लॉन्च होने पर पार्टनर आपको कॉल करेगा। फिर भी कीमत देखनी है?`,
  },
  bundleIntro: {
    en: (total: string, gst: string) => `Here's what I recommend — **${total}/month** (+${gst} GST), one bill, one support number:`,
    hi: (total: string, gst: string) => `मेरा सुझाव — **${total}/महीना** (+${gst} GST), एक बिल, एक सपोर्ट नंबर:`,
  },
  excludedIntro: { en: "Not included, and why:", hi: "ये शामिल नहीं हैं, क्योंकि:" },
  closing: {
    en: "You can switch add-ons on or off and pick 12/24/36 months in the quote. Ready to see it?",
    hi: "कोटेशन में आप ऐड-ऑन चालू/बंद कर सकते हैं और 12/24/36 महीने चुन सकते हैं। देखें?",
  },
  savings: {
    en: (s: string) => `That's about **${s} less** than you spend on telecom today.`,
    hi: (s: string) => `यह आपके अभी के टेलीकॉम खर्च से लगभग **${s} कम** है।`,
  },
  handoff: {
    en: "No problem — I've asked a local Accel partner to call you within 2 working hours. They'll see this chat, so you won't have to repeat anything.",
    hi: "ठीक है — Accel के लोकल पार्टनर 2 घंटे में आपको कॉल करेंगे। उन्हें यह चैट दिखेगी, आपको कुछ दोहराना नहीं पड़ेगा।",
  },
};

const t = <K extends keyof typeof T>(k: K, lang: Lang): (typeof T)[K][Lang] => T[k][lang];

const yesNo = (lang: Lang): Chip[] => [
  { label: lang === "hi" ? "हाँ, GST है" : "Yes, I have GST", value: "gst:yes" },
  { label: lang === "hi" ? "नहीं" : "No", value: "gst:no" },
];

const TYPE_CHIPS: Chip[] = [
  { label: "🛒 Kirana / shop", value: "type:Kirana store" },
  { label: "💇 Salon", value: "type:Salon" },
  { label: "🩺 Clinic", value: "type:Clinic" },
  { label: "📊 CA / law office", value: "type:CA firm" },
  { label: "🍽️ Restaurant chain", value: "type:Restaurant chain" },
  { label: "🏭 Factory / unit", value: "type:Manufacturing unit" },
];

const CITY_CHIPS: Chip[] = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Jaipur", "Lucknow", "Nagpur", "Kochi"].map((c) => ({ label: c, value: `city:${c}` }));

const EMP_CHIPS: Chip[] = [
  { label: "1-2", value: "emp:2" }, { label: "3-5", value: "emp:4" }, { label: "6-10", value: "emp:8" },
  { label: "11-25", value: "emp:15" }, { label: "26-50", value: "emp:35" }, { label: "50+", value: "emp:60" },
];

const SITE_CHIPS: Chip[] = [1, 2, 3, 5, 8, 10].map((n) => ({ label: String(n), value: `sites:${n}` }));

const NEEDS_BY_SEGMENT: Record<string, Need[]> = {
  micro: ["internet", "pos_billing", "whatsapp", "mobile_lines", "cctv", "guest_wifi", "website"],
  prof: ["internet", "email", "backup_internet", "device_security", "business_phone", "cloud_backup", "whatsapp", "guest_wifi"],
  multi: ["internet", "backup_internet", "multi_site_management", "cctv", "pos_billing", "mobile_lines", "firewall", "toll_free"],
  mfg: ["internet", "firewall", "machine_monitoring", "fleet_tracking", "mobile_lines", "email", "cctv", "static_ip"],
};

function applyChip(p: Profile, value: string): Profile {
  const [k, v] = value.split(/:(.*)/s);
  switch (k) {
    case "type": return { ...p, businessType: v, segment: undefined };
    case "city": return { ...p, city: v, cityTier: tierForCity(v) };
    case "emp": return { ...p, employees: Number(v) };
    case "sites": return { ...p, sites: Number(v) };
    case "gst": return { ...p, hasGstin: v === "yes" };
    case "needs": return { ...p, needs: [...new Set([...p.needs, ...(v ? (v.split(",") as Need[]) : [])])] };
    default: return p;
  }
}

export function runGuidedTurn(s: AdvisorSession, input: string, emit: (e: AdvisorEvent) => void) {
  const lang: Lang = s.language === "hi" ? "hi" : "en";
  const say = (text: string) => {
    emit({ type: "text", delta: text });
    s.transcript.push({ role: "assistant", text, at: new Date().toISOString() });
  };

  if (!input) {
    say(t("hello", lang));
    emit({ type: "chips", mode: "single", options: TYPE_CHIPS });
    s.guidedStep = "type";
    return;
  }

  let p = s.profile;
  if (/^(type|city|emp|sites|gst|needs):/.test(input)) {
    p = applyChip(p, input);
    if (input.startsWith("needs:")) s.guidedStep = "needs_done";
  } else {
    if (/\b(human|agent|call me|talk to (someone|person)|insaan|baat karni)\b|कॉल/i.test(input)) {
      s.status = "handoff";
      s.handoff = { reason: "Owner asked for a call", at: new Date().toISOString(), summary: "" };
      emit({ type: "handoff", reason: "Owner asked for a call" });
      say(t("handoff", lang));
      return;
    }
    const parsed = parseUtterance(input);
    if (parsed.gstin) {
      emit({ type: "status", label: "Checking GST registry…" });
      const { lookup, profile, known } = profileFromGstin(parsed.gstin);
      if (lookup.found) {
        p = { ...p, ...profile, needs: p.needs };
        say(t("gstFound", lang)(profile.businessName ?? "", profile.city ?? "", lookup.record!.status));
        emit({ type: "profile", profile: p, known });
      } else {
        say(t("gstNotFound", lang));
      }
    }
    p = mergeParsed(p, parsed);
    // Bare answers to the question we just asked.
    if (parsed.number !== undefined) {
      if (s.guidedStep === "employees") p.employees = parsed.number;
      if (s.guidedStep === "sites") p.sites = parsed.number;
    }
    if (s.guidedStep === "gst" && (parsed.yes || parsed.no)) p.hasGstin = !!parsed.yes;
    if (s.guidedStep === "type" && !p.businessType && !parsed.gstin && input.length < 40) p.businessType = input;
    if (s.guidedStep === "city" && !p.city && input.length < 30) p.city = input.trim();
    if (s.guidedStep === "needs") s.guidedStep = "needs_done";
  }
  if (p.city && !p.cityTier) p.cityTier = tierForCity(p.city);
  p.segment = inferSegment(p);
  s.profile = p;
  emit({ type: "profile", profile: p });

  if (p.city && !p.cityTier && s.guidedStep !== "not_served") {
    s.guidedStep = "not_served";
    say(t("notServed", lang)(p.city));
    emit({ type: "chips", mode: "single", options: [{ label: lang === "hi" ? "हाँ, कीमत दिखाइए" : "Yes, show prices", value: "city:Lucknow" }] });
    return;
  }

  const ask = (step: string, text: string, chips: Chip[], mode: "single" | "multi" = "single") => {
    s.guidedStep = step;
    say(text);
    emit({ type: "chips", mode, options: chips });
  };

  if (!p.businessType) return ask("type", lang === "hi" ? "आपका बिज़नेस क्या है?" : "What kind of business do you run?", TYPE_CHIPS);
  if (!p.city) return ask("city", t("city", lang), CITY_CHIPS);
  if (!p.employees) return ask("employees", t("employees", lang), EMP_CHIPS);
  if (p.segment === "multi" && !p.sites) return ask("sites", t("sites", lang), SITE_CHIPS);
  if (p.hasGstin === undefined) return ask("gst", t("gst", lang), yesNo(lang));
  if (s.guidedStep !== "needs_done" && p.needs.filter((n) => n !== "internet").length === 0) {
    const options = NEEDS_BY_SEGMENT[p.segment ?? "micro"].map((n) => ({ label: NEED_LABELS[n], value: n }));
    return ask("needs", t("needs", lang), options, "multi");
  }

  // Everything we need — build the bundle.
  emit({ type: "status", label: "Checking eligibility across 25 products…" });
  const rec = recommend({ profile: p, requestedProducts: s.requestedProducts, declinedProducts: s.declinedProducts });
  const quote = buildQuote({ lines: rec.lines, currentMonthlySpend: p.monthlySpend });
  s.recommendation = rec;
  s.quote = quote;
  s.status = "quoted";
  s.guidedStep = "quoted";
  emit({ type: "bundle", recommendation: rec, quote });

  const core = quote.lines.filter((l) => l.active);
  const lines = core.map((l) => `• **${l.name}**${l.qty > 1 ? ` × ${l.qty}` : ""} — ${inr(l.monthly)}: ${l.reason}`);
  let msg = `${t("bundleIntro", lang)(inr(quote.monthly), inr(quote.gst))}\n${lines.join("\n")}`;
  if (rec.excluded.length) {
    msg += `\n\n${t("excludedIntro", lang)}\n${rec.excluded.map((e) => `• ${product(e.productId).name}: ${e.reason}${e.alternative ? ` → ${e.alternative}` : ""}`).join("\n")}`;
  }
  if (rec.notes.length) msg += `\n\n${rec.notes.join("\n")}`;
  if (quote.savingsVsToday && quote.savingsVsToday > 0) msg += `\n\n${t("savings", lang)(inr(quote.savingsVsToday))}`;
  msg += `\n\n${t("closing", lang)}`;
  say(msg);
}
