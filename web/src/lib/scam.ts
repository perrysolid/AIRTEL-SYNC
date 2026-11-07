/**
 * SYNC Scam Shield: explainable, offline scam/phishing triage for messages, links and payment screenshots.
 *
 * It never claims a message is "safe" and never claims a payment arrived; it explains red flags and says what
 * to do. Rules are transparent on purpose, so an owner (and a judge) can see *why*. English + Hindi output.
 * Pure functions, no I/O: the text is analysed and never stored.
 */

export type ScamLang = "en" | "hi";
export type Verdict = "scam" | "suspicious" | "clear";
export type Severity = "high" | "med" | "info";

export interface ScamReason {
  code: string;
  severity: Severity;
  text: string;
}
export interface ScamLink {
  url: string;
  host: string;
  flags: string[];
}
export interface ScamResult {
  verdict: Verdict;
  label: string;
  advice: string;
  score: number;
  reasons: ScamReason[];
  links: ScamLink[];
  actions: string[];
  paymentScreenshot: boolean;
  lang: ScamLang;
}

const OFFICIAL: Record<string, string[]> = {
  airtel: ["airtel.in", "airtel.com"], jio: ["jio.com", "ril.com"], paytm: ["paytm.com"], phonepe: ["phonepe.com"],
  sbi: ["sbi.co.in", "onlinesbi.sbi", "sbi.bank.in"], hdfc: ["hdfcbank.com"], icici: ["icicibank.com"], axis: ["axisbank.com"],
  uidai: ["uidai.gov.in"], gst: ["gst.gov.in"], incometax: ["incometax.gov.in"], npci: ["npci.org.in"], irctc: ["irctc.co.in"],
  amazon: ["amazon.in", "amazon.com"], flipkart: ["flipkart.com"], whatsapp: ["whatsapp.com", "wa.me"], epfo: ["epfindia.gov.in"],
  google: ["google.com"], bsnl: ["bsnl.co.in"], accel: ["accelbusiness.example"],
};
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "is.gd", "goo.gl", "t.ly", "shorturl.at", "tiny.cc", "ow.ly", "rebrand.ly"]);
const RISKY_TLD = new Set(["xyz", "top", "click", "icu", "vip", "cfd", "sbs", "buzz", "monster", "rest", "work", "loan", "gq", "tk", "ml", "cf", "ga", "support", "help"]);
const SECOND_LEVEL = new Set(["co", "gov", "org", "net", "ac", "nic", "in", "com"]);

// [code, pattern, weight, severity]
const SIGNALS: [string, RegExp, number, Severity][] = [
  ["otp_ask", /(share|send|tell|give|forward|enter)\W+(\w+\W+){0,3}(otp|pin|cvv|password)|otp\W+(bata|batao|do|dena|share)|ओटीपी\W*(बताओ|दो|शेयर)|upi\s*pin/i, 58, "high"],
  ["remote_app", /anydesk|teamviewer|quick ?support|rustdesk|screen ?shar/i, 50, "high"],
  ["authority", /digital arrest|cbi\b|police\b|customs officer|narcotics|arrest warrant|cyber ?cell|पुलिस|गिरफ्तार/i, 45, "high"],
  ["collect", /collect request|approve (the )?request to receive|accept the request to (receive|get)|request to receive/i, 42, "high"],
  ["wrong_transfer", /by mistake|sent .{0,40}mistake|wrong (number|account)|please (return|send back|refund|transfer back)|send (it )?back|गलती से|वापस (कर|भेज)/i, 45, "high"],
  ["kyc_threat", /\bkyc\b|update your (pan|aadhaar|aadhar|account|details)|verify your account|(account|sim|number|connection|service)\W+(will be |is |gets? )?(blocked|suspended|deactivated|disconnected|closed)|खाता बंद|सिम\W*(बंद|ब्लॉक)|केवाईसी/i, 24, "med"],
  ["urgency", /immediately|within \d+ ?(hours?|hrs|minutes?|mins?)|last chance|expires? (today|tonight)|urgent|act now|today only|तुरंत|आज ही|अभी|जल्दी/i, 14, "med"],
  ["prize", /lottery|kbc|you (have )?won|prize|lucky draw|reward points?|cashback of|free (gift|recharge)|इनाम|लॉटरी/i, 28, "high"],
  ["money_lure", /double your money|guaranteed returns?|work from home|earn (rs\.?|₹)?\s*\d+|part[- ]time job|loan (approved|offer)|pre[- ]approved|no documents/i, 24, "med"],
  ["bill_threat", /electricity (bill|will)|power (will be )?(cut|disconnect)|bijli|बिजली\W*(कट|बिल)|gas (connection|bill)/i, 26, "med"],
  ["parcel", /parcel|courier|customs|delivery (failed|attempt)|redelivery|पार्सल/i, 16, "med"],
  ["fee", /processing fee|registration fee|advance (fee|payment)|pay (a )?(small )?fee|refundable deposit|clearance fee/i, 24, "med"],
  ["call_number", /call (us |now )?(on|at)?\s*[+0]?\d{10,12}|whatsapp (us )?(on|at)\s*[+0]?\d{10,12}/i, 12, "info"],
  ["fake_support", /customer care (number|no)|helpline (number|no)|toll[- ]?free (number|no)/i, 10, "info"],
];
const PAY_SHOT = /(payment|paid|amount) (successful|received|done|completed|sent)|transaction (id|successful)|upi ref|utr|paid to|sent (you )?(₹|rs)|credited soon|will (reflect|credit)|check (your )?account/i;
const LINK_WEIGHT: Record<string, number> = { lookalike: 55, shortener: 18, risky_tld: 26, ip_host: 40, punycode: 40, apk: 45, http: 8 };

const TEXT = {
  en: {
    labels: { scam: "Likely a scam", suspicious: "Suspicious", clear: "No red flags found" },
    advice: { scam: "Do not click, reply or pay.", suspicious: "Be careful. Verify before you act.", clear: "Nothing obviously wrong, but no tool can prove a message is safe." },
    shotLabel: "Not proof of payment",
    shotAdvice: "A screenshot can be faked. Check your bank/UPI app first.",
    reasons: {
      otp_ask: "It asks for an OTP, PIN or password. Real banks, UPI apps and Accel never ask for these.",
      remote_app: "It asks you to install a remote-access app. That lets a stranger see and control your phone.",
      authority: "It threatens arrest or legal action by 'police/CBI/customs'. 'Digital arrest' does not exist; this is a known scam.",
      collect: "It asks you to approve a 'request' to receive money. You never have to approve anything to receive money.",
      wrong_transfer: "'Sent by mistake, please return' is a common trick: the original credit is often fake or reversed later.",
      kyc_threat: "It threatens to block your account/SIM unless you 'update KYC'. Real KYC is done in the official app or at a branch.",
      urgency: "It pushes you to act within minutes or hours. Scammers rely on panic.",
      prize: "It promises a prize, reward or free gift you never entered for.",
      money_lure: "It promises easy money, guaranteed returns or a pre-approved loan.",
      bill_threat: "It says your electricity/gas will be cut unless you pay now. Check your real bill in the utility's own app.",
      parcel: "It talks about a parcel or customs fee you did not expect.",
      fee: "It asks for an upfront fee before giving you money or a job.",
      call_number: "It tells you to call or WhatsApp a mobile number. Official helplines are not personal mobile numbers.",
      fake_support: "It gives a 'customer care number'. Search it yourself on the official website instead.",
      lookalike: "The link {host} imitates {brand} but is not its official site ({official}).",
      shortener: "The link {host} hides where it really goes.",
      risky_tld: "The link {host} uses a domain ending often seen in scam sites (.{tld}).",
      ip_host: "The link goes to a bare IP address, not a real website name.",
      punycode: "The link {host} uses look-alike foreign characters to imitate a real site.",
      apk: "It wants you to download an app file (.apk) outside the Play Store. These often steal OTPs and messages.",
      http: "The link {host} is not secure (http, not https).",
      payment_screenshot: "This looks like a payment screenshot. A screenshot is NOT proof of payment: check your bank/UPI app, SMS or soundbox before handing over goods.",
    } as Record<string, string>,
    do: {
      scam: ["Do not click any link, call any number or share any code.", "Block the sender.", "Report it: Chakshu on sancharsaathi.gov.in (for calls, SMS and WhatsApp).", "If you already paid or shared an OTP: call 1930 immediately and report at cybercrime.gov.in. Speed matters."],
      suspicious: ["Do not pay or share anything yet.", "Check the claim in the official app or website that you type yourself, not from this message.", "If unsure, forward it to SYNC again or ask a partner."],
      clear: ["Still, never share OTP/PIN with anyone.", "For money, trust only your bank/UPI app balance, not screenshots or messages."],
      shot: ["Open your UPI app / bank SMS / soundbox and confirm the credit before handing over goods.", "Never act on 'sent by mistake' requests; ask them to refund through the bank."],
    },
  },
  hi: {
    labels: { scam: "ठगी की आशंका", suspicious: "संदिग्ध", clear: "कोई ख़तरे का संकेत नहीं मिला" },
    advice: { scam: "न क्लिक करें, न जवाब दें, न पैसे दें।", suspicious: "सावधान रहें। कुछ करने से पहले जाँच लें।", clear: "कुछ गड़बड़ नहीं दिखी, पर कोई टूल यह साबित नहीं कर सकता कि संदेश सुरक्षित है।" },
    shotLabel: "भुगतान का सबूत नहीं",
    shotAdvice: "स्क्रीनशॉट नकली हो सकता है। पहले अपना बैंक/UPI ऐप देखें।",
    reasons: {
      otp_ask: "इसमें OTP, PIN या पासवर्ड माँगा गया है। असली बैंक, UPI ऐप या Accel कभी नहीं माँगते।",
      remote_app: "यह रिमोट-एक्सेस ऐप इंस्टॉल करने को कहता है। इससे अजनबी आपका फ़ोन देख और चला सकता है।",
      authority: "यह 'पुलिस/CBI/कस्टम' के नाम पर गिरफ़्तारी की धमकी देता है। 'डिजिटल अरेस्ट' जैसी कोई चीज़ नहीं होती; यह जानी-पहचानी ठगी है।",
      collect: "यह पैसे पाने के लिए 'रिक्वेस्ट' मंज़ूर करने को कहता है। पैसे पाने के लिए आपको कुछ मंज़ूर नहीं करना पड़ता।",
      wrong_transfer: "'गलती से भेज दिए, वापस कर दीजिए' आम चाल है: असली क्रेडिट अक्सर नकली होता है या बाद में लौट जाता है।",
      kyc_threat: "यह 'KYC अपडेट' न करने पर खाता/सिम बंद करने की धमकी देता है। असली KYC आधिकारिक ऐप या शाखा में होता है।",
      urgency: "यह मिनटों या घंटों में कुछ करने का दबाव डालता है। ठग घबराहट पर निर्भर रहते हैं।",
      prize: "यह ऐसे इनाम या गिफ़्ट का वादा करता है जिसमें आपने हिस्सा ही नहीं लिया।",
      money_lure: "यह आसान कमाई, पक्के रिटर्न या पहले से मंज़ूर लोन का वादा करता है।",
      bill_threat: "यह कहता है कि अभी भुगतान न किया तो बिजली/गैस कट जाएगी। असली बिल उसी कंपनी के ऐप में देखें।",
      parcel: "यह ऐसे पार्सल या कस्टम शुल्क की बात करता है जिसकी आपको उम्मीद नहीं थी।",
      fee: "यह पैसे या नौकरी देने से पहले अग्रिम शुल्क माँगता है।",
      call_number: "यह किसी मोबाइल नंबर पर कॉल/WhatsApp करने को कहता है। आधिकारिक हेल्पलाइन निजी मोबाइल नंबर नहीं होती।",
      fake_support: "यह 'कस्टमर केयर नंबर' देता है। नंबर ख़ुद आधिकारिक वेबसाइट पर खोजें।",
      lookalike: "लिंक {host}, {brand} की नकल करता है पर उसकी असली साइट ({official}) नहीं है।",
      shortener: "लिंक {host} असली पता छिपाता है।",
      risky_tld: "लिंक {host} ऐसे डोमेन (.{tld}) पर है जो ठगी की साइटों में आम है।",
      ip_host: "लिंक किसी असली वेबसाइट नहीं, सीधे IP पते पर जाता है।",
      punycode: "लिंक {host} असली साइट की नकल के लिए मिलते-जुलते विदेशी अक्षर इस्तेमाल करता है।",
      apk: "यह प्ले स्टोर के बाहर से ऐप फ़ाइल (.apk) डाउनलोड करने को कहता है। ऐसी फ़ाइलें अक्सर OTP और संदेश चुराती हैं।",
      http: "लिंक {host} सुरक्षित नहीं है (https नहीं, http)।",
      payment_screenshot: "यह पेमेंट का स्क्रीनशॉट लगता है। स्क्रीनशॉट भुगतान का सबूत नहीं है: सामान देने से पहले अपना बैंक/UPI ऐप, SMS या साउंडबॉक्स देखें।",
    } as Record<string, string>,
    do: {
      scam: ["कोई लिंक न खोलें, कोई नंबर न मिलाएँ, कोई कोड साझा न करें।", "भेजने वाले को ब्लॉक करें।", "रिपोर्ट करें: sancharsaathi.gov.in पर Chakshu (कॉल, SMS और WhatsApp के लिए)।", "अगर पैसे भेज चुके हैं या OTP बता दिया है: तुरंत 1930 पर कॉल करें और cybercrime.gov.in पर शिकायत करें। देरी न करें।"],
      suspicious: ["अभी पैसे न दें, कुछ साझा न करें।", "दावे की जाँच आधिकारिक ऐप/वेबसाइट पर करें, जिसे आप ख़ुद खोलें, इस संदेश से नहीं।", "संदेह हो तो इसे फिर SYNC को भेजें या पार्टनर से पूछें।"],
      clear: ["फिर भी OTP/PIN किसी को न बताएँ।", "पैसे के लिए सिर्फ़ अपने बैंक/UPI ऐप पर भरोसा करें, स्क्रीनशॉट या संदेश पर नहीं।"],
      shot: ["सामान देने से पहले UPI ऐप / बैंक SMS / साउंडबॉक्स में रक़म आई है, यह देख लें।", "'गलती से भेज दिए' वाली माँग पर कुछ न करें; कहें कि बैंक के ज़रिए रिफ़ंड करें।"],
    },
  },
} as const;

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"')]+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|xyz|top|click|icu|vip|cfd|sbs|buzz|co|apk|app|info|live|shop|site|online|link|me|gq|tk|ml|cf|ga)(?:\/[^\s]*)?/gi;

function registrable(host: string): string {
  const parts = host.split(".");
  if (parts.length >= 3 && SECOND_LEVEL.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

type Flag = [string, Record<string, string>];

export function analyzeLink(raw: string): { url: string; host: string; flags: Flag[] } {
  const u = /^https?:\/\//i.test(raw) ? raw : "http://" + raw;
  let host = "";
  try {
    host = new URL(u).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return { url: raw, host: raw, flags: [] };
  }
  const flags: Flag[] = [];
  const reg = registrable(host);
  const tld = host.split(".").pop() ?? "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) flags.push(["ip_host", {}]);
  if (host.startsWith("xn--") || host.includes(".xn--")) flags.push(["punycode", { host }]);
  if (SHORTENERS.has(reg)) flags.push(["shortener", { host }]);
  if (RISKY_TLD.has(tld)) flags.push(["risky_tld", { host, tld }]);
  const label = host.replace(/-/g, "").replace(/\./g, "");
  for (const [brand, doms] of Object.entries(OFFICIAL)) {
    if (label.includes(brand) && !doms.some((d) => reg === d || host.endsWith("." + d) || host === d)) {
      flags.push(["lookalike", { host, brand: brand.length <= 4 ? brand.toUpperCase() : brand[0].toUpperCase() + brand.slice(1), official: doms[0] }]);
      break;
    }
  }
  if (/^http:\/\//i.test(raw) && !flags.some((f) => f[0] === "lookalike")) flags.push(["http", { host }]);
  if (/\.apk(\?|$|\/)/i.test(u)) flags.push(["apk", {}]);
  return { url: raw, host, flags };
}

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export function analyzeScam(text: string, lang: ScamLang = "en", fromScreenshot = false): ScamResult {
  const L = TEXT[lang] ?? TEXT.en;
  const t = text ?? "";
  const low = t.toLowerCase();
  let score = 0;
  const reasons: ScamReason[] = [];
  const seen = new Set<string>();
  const safeNote = /(do not|don'?t|never)\W+(\w+\W+){0,3}share|कभी .* न बताएं|किसी को न बताएं/i.test(low);

  for (const [code, pat, w, sev] of SIGNALS) {
    if (!pat.test(low)) continue;
    if (code === "otp_ask" && safeNote && !/(please|kindly|now|immediately)\W+(share|send)/i.test(low)) continue;
    score += w;
    seen.add(code);
    reasons.push({ code, severity: sev, text: L.reasons[code] });
  }

  const links: ScamLink[] = [];
  for (const m of t.matchAll(URL_RE)) {
    const raw = m[0].replace(/[.,;:!?)]+$/, "");
    const before = t.slice(Math.max(0, (m.index ?? 0) - 1), m.index ?? 0);
    if (/^(e\.g|i\.e)$/i.test(raw) || before === "@") continue;
    const info = analyzeLink(raw);
    links.push({ url: raw, host: info.host, flags: info.flags.map((f) => f[0]) });
    for (const [code, vars] of info.flags) {
      score += LINK_WEIGHT[code] ?? 10;
      seen.add(code);
      reasons.push({ code, severity: (LINK_WEIGHT[code] ?? 0) >= 26 ? "high" : "med", text: fill(L.reasons[code], vars) });
    }
  }

  const shot = PAY_SHOT.test(t) || (fromScreenshot && /₹|rs\.?\s*\d|upi|paid/i.test(low));
  if (shot) {
    reasons.push({ code: "payment_screenshot", severity: "info", text: L.reasons.payment_screenshot });
    if (seen.has("wrong_transfer") || seen.has("collect")) score += 15;
  }
  if (["urgency", "kyc_threat", "otp_ask", "prize"].filter((c) => seen.has(c)).length >= 2) score += 12; // combinations are much riskier
  score = Math.min(score, 100);

  let verdict: Verdict = score >= 55 ? "scam" : score >= 24 ? "suspicious" : "clear";
  const shotOnly = shot && verdict === "clear";
  if (shotOnly) verdict = "suspicious";
  const order = { high: 0, med: 1, info: 2 } as const;
  reasons.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    verdict,
    label: shotOnly ? L.shotLabel : L.labels[verdict],
    advice: shotOnly ? L.shotAdvice : L.advice[verdict],
    score,
    reasons,
    links,
    actions: [...L.do[verdict], ...(shot ? L.do.shot : [])],
    paymentScreenshot: shot,
    lang,
  };
}

/** Plain-chat rendering used by the WhatsApp and Telegram bots. */
export function scamChatText(r: ScamResult): string {
  const icon = { scam: "🚨", suspicious: "⚠️", clear: "🔎" }[r.verdict];
  const lines = [`${icon} **${r.label}** (risk ${r.score}/100)`, r.advice];
  if (r.reasons.length) lines.push("", ...r.reasons.slice(0, 4).map((x) => `• ${x.text}`));
  lines.push("", ...r.actions.slice(0, 4).map((a, i) => `${i + 1}. ${a}`));
  return lines.join("\n");
}

/** Heuristic: does a chat message look like something forwarded for checking (a link or scam wording)? */
export function looksForwarded(text: string): boolean {
  if (/https?:\/\/|www\./i.test(text)) return true;
  const r = analyzeScam(text);
  return r.score >= 40;
}
