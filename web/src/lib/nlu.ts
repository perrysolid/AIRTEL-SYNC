import type { Need, Profile } from "./profile";
import { CITY_ALIASES, TIER1_CITIES, TIER2_CITIES } from "./profile";

/**
 * Lightweight bilingual (English / Hindi / Hinglish) slot extraction used by
 * the guided advisor when no LLM is available, and as a pre-pass that fills
 * obvious facts before the LLM sees the message.
 */

const NEED_WORDS: [RegExp, Need][] = [
  [/wi-?fi|internet|broadband|fib(re|er)|net\b|इंटरनेट|वाईफाई|वाई-फाई|नेट/i, "internet"],
  [/backup|fail ?over|net (goes|jata)|बैकअप/i, "backup_internet"],
  [/\bsims?\b|mobile (line|number|connection)|postpaid|सिम|मोबाइल/i, "mobile_lines"],
  [/whats ?app|व्हाट्सएप|वॉट्सऐप/i, "whatsapp"],
  [/\bsms\b|text message|एसएमएस/i, "sms"],
  [/website|web ?site|domain|google pe|वेबसाइट/i, "website"],
  [/e-?mail|gmail|office suite|ईमेल/i, "email"],
  [/cloud backup|data backup|data safe|डेटा बैकअप/i, "cloud_backup"],
  [/\bpos\b|billing|bill machine|upi|card machine|swipe|बिलिंग|यूपीआई/i, "pos_billing"],
  [/antivirus|virus|ransomware|एंटीवायरस/i, "device_security"],
  [/firewall|hack|cyber|security|सुरक्षा|फ़ायरवॉल/i, "firewall"],
  [/guest wi-?fi|customer wi-?fi|free wi-?fi|ग्राहक.*वाईफाई/i, "guest_wifi"],
  [/cctv|camera|कैमरा|सीसीटीवी/i, "cctv"],
  [/ivr|landline|office phone|call recording|telephony|reception/i, "business_phone"],
  [/toll ?free|1800/i, "toll_free"],
  [/static ip|fixed ip/i, "static_ip"],
  [/all (branches|stores|outlets)|central(ly)? manage|sd-?wan/i, "multi_site_management"],
  [/machine|sensor|iot|energy|मशीन/i, "machine_monitoring"],
  [/fleet|gps|vehicle|delivery (van|bike)|truck|गाड़ी|वाहन/i, "fleet_tracking"],
];

const TYPE_WORDS: [RegExp, string][] = [
  [/kirana|grocery|general store|किराना|दुकान/i, "Kirana store"],
  [/salon|parlou?r|सैलून|पार्लर/i, "Salon"],
  [/pharmacy chain|medical chain/i, "Pharmacy chain"],
  [/pharmacy|chemist|medical store|दवा/i, "Pharmacy"],
  [/bakery chain/i, "Bakery chain"],
  [/bakery|बेकरी/i, "Bakery"],
  [/sweet|mithai|मिठाई/i, "Sweet shop"],
  [/boutique|tailor|बुटीक/i, "Boutique"],
  [/stationery|स्टेशनरी/i, "Stationery shop"],
  [/hardware/i, "Hardware store"],
  [/optic|chashm|चश्म/i, "Optician"],
  [/mobile (shop|repair)/i, "Mobile repair shop"],
  [/dental|dentist|दांत/i, "Dental clinic"],
  [/physio/i, "Physiotherapy clinic"],
  [/diagnostic|pathology|\blab\b|लैब/i, "Diagnostic lab"],
  [/clinic|doctor|क्लिनिक|डॉक्टर/i, "Clinic"],
  [/\bca\b|chartered|accountant|ca firm/i, "CA firm"],
  [/law|lawyer|advocate|legal|वकील/i, "Law office"],
  [/coaching|tuition|classes|कोचिंग/i, "Coaching centre"],
  [/travel/i, "Travel agency"],
  [/insurance|बीमा/i, "Insurance agency"],
  [/real ?estate|property|प्रॉपर्टी/i, "Real estate agency"],
  [/architect/i, "Architecture studio"],
  [/restaurant|cafe|dhaba|रेस्टोरेंट|ढाबा/i, "Restaurant chain"],
  [/hotel|stays|guest ?house|होटल/i, "Budget hotel group"],
  [/gym/i, "Gym chain"],
  [/pre-?school|play ?school/i, "Pre-school chain"],
  [/(retail|store|shop)s? chain|showroom/i, "Electronics retail chain"],
  [/textile|garment|कपड़ा/i, "Textile unit"],
  [/auto ?parts/i, "Auto-parts unit"],
  [/plastic/i, "Plastic moulding unit"],
  [/packag/i, "Packaging unit"],
  [/printing/i, "Printing press"],
  [/furniture|wood/i, "Furniture workshop"],
  [/food processing/i, "Food processing unit"],
  [/factory|manufactur|फैक्ट्री|कारखाना/i, "Manufacturing unit"],
];

const HINDI_DIGITS: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };
const WORD_NUMS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "बीस": 20,
};

const GSTIN_IN_TEXT = /\b\d{2}[A-Z0-9]{13}\b/i;

export interface Parsed {
  gstin?: string;
  businessType?: string;
  city?: string;
  employees?: number;
  sites?: number;
  hasGstin?: boolean;
  fibreAvailable?: boolean;
  needs: Need[];
  number?: number;
  yes?: boolean;
  no?: boolean;
}

function toNumber(s: string): number | undefined {
  const n = Number(s.replace(/[०-९]/g, (d) => HINDI_DIGITS[d]));
  return Number.isFinite(n) ? n : undefined;
}

export function parseUtterance(raw: string): Parsed {
  const text = raw.trim();
  const out: Parsed = { needs: [] };
  const g = text.match(GSTIN_IN_TEXT) ?? text.replace(/[\s-]+/g, "").match(/\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]{3}/i);
  if (g) out.gstin = g[0].toUpperCase();

  for (const [re, t] of TYPE_WORDS) if (re.test(text)) { out.businessType = t; break; }
  for (const [re, n] of NEED_WORDS) if (re.test(text) && !out.needs.includes(n)) out.needs.push(n);
  // "wifi for customers" is guest Wi-Fi, not just internet
  if (/(customer|guest|patient|client|visitor|student|ग्राहक).{0,15}wi-?fi|wi-?fi.{0,15}(customer|guest|patient|client|visitor|student)/i.test(text) && !out.needs.includes("guest_wifi")) out.needs.push("guest_wifi");

  // Served cities, their old/short names, and a few towns we don't serve yet (so we can say so).
  const allCities = [...TIER1_CITIES, ...TIER2_CITIES, ...Object.keys(CITY_ALIASES), "Manali", "Ooty", "Rishikesh", "Munnar", "Darjeeling", "Haridwar"];
  const city = allCities.find((c) => new RegExp(`\\b${c}\\b`, "i").test(text));
  if (city) out.city = CITY_ALIASES[city.toLowerCase()] ?? city;

  const num = (re: RegExp) => {
    const m = text.match(re);
    if (!m) return undefined;
    return toNumber(m[1]) ?? WORD_NUMS[m[1].toLowerCase()];
  };
  const numWord = "(\\d+|[०-९]+|" + Object.keys(WORD_NUMS).join("|") + ")";
  out.employees = num(new RegExp(`${numWord}\\s*(people|staff|employees|log|लोग|कर्मचारी|workers|members|person)`, "i"));
  out.sites = num(new RegExp(`${numWord}\\s*(sites|branches|stores|outlets|locations|shops|clinics|centres|centers|ब्रांच|दुकानें|जगह)`, "i"));
  const bare = text.match(/^\s*(\d+|[०-९]+)\s*$/);
  if (bare) out.number = toNumber(bare[1]);
  else if (WORD_NUMS[text.toLowerCase()]) out.number = WORD_NUMS[text.toLowerCase()];

  if (/\b(no gst|without gst|not registered|gst nahi|gst नहीं|no gstin)\b|जीएसटी नहीं/i.test(text)) out.hasGstin = false;
  else if (/\b(have gst|gst registered|gst hai|gstin hai)\b|जीएसटी है/i.test(text)) out.hasGstin = true;
  if (/no fib(re|er)|fib(re|er) (not|nahi)|fiber not available/i.test(text)) out.fibreAvailable = false;

  // \b is ASCII-only in JS, so use an explicit end-of-word lookahead for Devanagari.
  if (/^(yes|yeah|haan|han|ha|ji|हाँ|हां|जी|sure|ok|okay)(?=[\s,.!?]|$)/i.test(text)) out.yes = true;
  if (/^(no|nahi|nahin|नहीं|na)(?=[\s,.!?]|$)/i.test(text)) out.no = true;
  return out;
}

/** Merges parsed facts into a profile without overwriting what we already know. */
export function mergeParsed(p: Profile, parsed: Parsed): Profile {
  return {
    ...p,
    businessType: p.businessType ?? parsed.businessType,
    city: p.city ?? parsed.city,
    employees: parsed.employees ?? p.employees,
    sites: parsed.sites ?? p.sites,
    hasGstin: parsed.hasGstin ?? p.hasGstin,
    fibreAvailable: parsed.fibreAvailable ?? p.fibreAvailable,
    needs: [...new Set([...p.needs, ...parsed.needs])],
  };
}
