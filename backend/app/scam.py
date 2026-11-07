"""SYNC Scam Shield: explainable, offline scam/phishing triage for messages, links and payment screenshots.

It never claims a message is 'safe' and never claims a payment arrived; it explains red flags and says what to do.
Rules are transparent on purpose (judges and owners can see *why*). English + Hindi output."""
from __future__ import annotations
import re
from urllib.parse import urlparse

OFFICIAL = {
    "airtel": ["airtel.in", "airtel.com"], "jio": ["jio.com", "ril.com"], "paytm": ["paytm.com"], "phonepe": ["phonepe.com"],
    "sbi": ["sbi.co.in", "onlinesbi.sbi", "sbi.bank.in"], "hdfc": ["hdfcbank.com"], "icici": ["icicibank.com"], "axis": ["axisbank.com"],
    "uidai": ["uidai.gov.in"], "gst": ["gst.gov.in"], "incometax": ["incometax.gov.in"], "npci": ["npci.org.in"], "irctc": ["irctc.co.in"],
    "amazon": ["amazon.in", "amazon.com"], "flipkart": ["flipkart.com"], "whatsapp": ["whatsapp.com", "wa.me"], "epfo": ["epfindia.gov.in"],
    "google": ["google.com"], "bsnl": ["bsnl.co.in"], "tata": ["tata.com"], "accel": ["accelbusiness.example"],
}
SHORTENERS = {"bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "is.gd", "goo.gl", "t.ly", "shorturl.at", "tiny.cc", "ow.ly", "rebrand.ly"}
RISKY_TLD = {"xyz", "top", "click", "icu", "vip", "cfd", "sbs", "buzz", "monster", "rest", "work", "loan", "gq", "tk", "ml", "cf", "ga", "support", "help"}
SECOND_LEVEL = {"co", "gov", "org", "net", "ac", "nic", "in", "com"}

# (code, regex, weight, severity) severities: high | med | info
SIGNALS = [
    ("otp_ask", r"(share|send|tell|give|forward|enter)\W+(\w+\W+){0,3}(otp|pin|cvv|password)|otp\W+(bata|batao|do|dena|share)|ओटीपी\W*(बताओ|दो|शेयर)|upi\s*pin", 58, "high"),
    ("remote_app", r"anydesk|teamviewer|quick ?support|rustdesk|screen ?shar", 50, "high"),
    ("authority", r"digital arrest|cbi\b|police\b|customs officer|narcotics|arrest warrant|cyber ?cell|पुलिस|गिरफ्तार", 45, "high"),
    ("collect", r"collect request|approve (the )?request to receive|accept the request to (receive|get)|request to receive", 42, "high"),
    ("wrong_transfer", r"by mistake|sent .{0,40}mistake|wrong (number|account)|please (return|send back|refund|transfer back)|send (it )?back|गलती से|वापस (कर|भेज)", 45, "high"),
    ("kyc_threat", r"\bkyc\b|update your (pan|aadhaar|aadhar|account|details)|verify your account|(account|sim|number|connection|service)\W+(will be |is |gets? )?(blocked|suspended|deactivated|disconnected|closed)|खाता बंद|सिम\W*(बंद|ब्लॉक)|केवाईसी", 24, "med"),
    ("urgency", r"immediately|within \d+ ?(hours?|hrs|minutes?|mins?)|last chance|expires? (today|tonight)|urgent|act now|today only|तुरंत|आज ही|अभी|जल्दी", 14, "med"),
    ("prize", r"lottery|kbc|you (have )?won|prize|lucky draw|reward points?|cashback of|free (gift|recharge)|इनाम|लॉटरी", 28, "high"),
    ("money_lure", r"double your money|guaranteed returns?|work from home|earn (rs\.?|₹)?\s*\d+|part[- ]time job|loan (approved|offer)|pre[- ]approved|no documents|व्यापार में निवेश", 24, "med"),
    ("bill_threat", r"electricity (bill|will)|power (will be )?(cut|disconnect)|bijli|बिजली\W*(कट|बिल)|gas (connection|bill)", 26, "med"),
    ("parcel", r"parcel|courier|customs|delivery (failed|attempt)|redelivery|पार्सल", 16, "med"),
    ("fee", r"processing fee|registration fee|advance (fee|payment)|pay (a )?(small )?fee|refundable deposit|clearance fee", 24, "med"),
    ("call_number", r"call (us |now )?(on|at)?\s*[+0]?\d{10,12}|whatsapp (us )?(on|at)\s*[+0]?\d{10,12}", 12, "info"),
    ("fake_support", r"customer care (number|no)|helpline (number|no)|toll[- ]?free (number|no)", 10, "info"),
]
PAY_SHOT = re.compile(r"(payment|paid|amount) (successful|received|done|completed|sent)|transaction (id|successful)|upi ref|utr|paid to|sent (you )?(₹|rs)|credited soon|will (reflect|credit)|check (your )?account", re.I)

TEXT = {
 "en": {
  "labels": {"scam": "Likely a scam", "suspicious": "Suspicious", "clear": "No red flags found"},
  "advice": {"scam": "Do not click, reply or pay.", "suspicious": "Be careful. Verify before you act.", "clear": "Nothing obviously wrong, but no tool can prove a message is safe."},
  "reasons": {
   "otp_ask": "It asks for an OTP, PIN or password. Real banks, UPI apps and Accel never ask for these.",
   "remote_app": "It asks you to install a remote-access app. That lets a stranger see and control your phone.",
   "authority": "It threatens arrest or legal action by 'police/CBI/customs'. 'Digital arrest' does not exist; this is a known scam.",
   "collect": "It asks you to approve a 'request' to receive money. You never have to approve anything to receive money.",
   "wrong_transfer": "'Sent by mistake, please return' is a common trick: the original credit is often fake or reversed later.",
   "kyc_threat": "It threatens to block your account/SIM unless you 'update KYC'. Real KYC is done in the official app or at a branch.",
   "urgency": "It pushes you to act within minutes or hours. Scammers rely on panic.",
   "prize": "It promises a prize, reward or free gift you never entered for.",
   "money_lure": "It promises easy money, guaranteed returns or a pre-approved loan.",
   "bill_threat": "It says your electricity/gas will be cut unless you pay now. Check your real bill in the utility's own app.",
   "parcel": "It talks about a parcel or customs fee you did not expect.",
   "fee": "It asks for an upfront fee before giving you money or a job.",
   "call_number": "It tells you to call or WhatsApp a mobile number. Official helplines are not personal mobile numbers.",
   "fake_support": "It gives a 'customer care number'. Search it yourself on the official website instead.",
   "lookalike": "The link {host} imitates {brand} but is not its official site ({official}).",
   "shortener": "The link {host} hides where it really goes.",
   "risky_tld": "The link {host} uses a domain ending often seen in scam sites (.{tld}).",
   "ip_host": "The link goes to a bare IP address, not a real website name.",
   "punycode": "The link {host} uses look-alike foreign characters to imitate a real site.",
   "apk": "It wants you to download an app file (.apk) outside the Play Store. These often steal OTPs and messages.",
   "http": "The link {host} is not secure (http, not https).",
   "payment_screenshot": "This looks like a payment screenshot. A screenshot is NOT proof of payment: check your bank/UPI app, SMS or soundbox before handing over goods.",
  },
  "do": {
   "scam": ["Do not click any link, call any number or share any code.", "Block the sender.", "Report it: Chakshu on sancharsaathi.gov.in (for calls, SMS and WhatsApp).",
            "If you already paid or shared an OTP: call 1930 immediately and report at cybercrime.gov.in. Speed matters."],
   "suspicious": ["Do not pay or share anything yet.", "Check the claim in the official app or website that you type yourself, not from this message.", "If unsure, forward it to SYNC again or ask a partner."],
   "clear": ["Still, never share OTP/PIN with anyone.", "For money, trust only your bank/UPI app balance, not screenshots or messages."],
   "shot": ["Open your UPI app / bank SMS / soundbox and confirm the credit before handing over goods.", "Never act on 'sent by mistake' requests; ask them to refund through the bank."],
  },
 },
 "hi": {
  "labels": {"scam": "ठगी की आशंका", "suspicious": "संदिग्ध", "clear": "कोई ख़तरे का संकेत नहीं मिला"},
  "advice": {"scam": "न क्लिक करें, न जवाब दें, न पैसे दें।", "suspicious": "सावधान रहें। कुछ करने से पहले जाँच लें।", "clear": "कुछ गड़बड़ नहीं दिखी, पर कोई टूल यह साबित नहीं कर सकता कि संदेश सुरक्षित है।"},
  "reasons": {
   "otp_ask": "इसमें OTP, PIN या पासवर्ड माँगा गया है। असली बैंक, UPI ऐप या Accel कभी नहीं माँगते।",
   "remote_app": "यह रिमोट-एक्सेस ऐप इंस्टॉल करने को कहता है। इससे अजनबी आपका फ़ोन देख और चला सकता है।",
   "authority": "यह 'पुलिस/CBI/कस्टम' के नाम पर गिरफ़्तारी की धमकी देता है। 'डिजिटल अरेस्ट' जैसी कोई चीज़ नहीं होती; यह जानी-पहचानी ठगी है।",
   "collect": "यह पैसे पाने के लिए 'रिक्वेस्ट' मंज़ूर करने को कहता है। पैसे पाने के लिए आपको कुछ मंज़ूर नहीं करना पड़ता।",
   "wrong_transfer": "'गलती से भेज दिए, वापस कर दीजिए' आम चाल है: असली क्रेडिट अक्सर नकली होता है या बाद में लौट जाता है।",
   "kyc_threat": "यह 'KYC अपडेट' न करने पर खाता/सिम बंद करने की धमकी देता है। असली KYC आधिकारिक ऐप या शाखा में होता है।",
   "urgency": "यह मिनटों या घंटों में कुछ करने का दबाव डालता है। ठग घबराहट पर निर्भर रहते हैं।",
   "prize": "यह ऐसे इनाम या गिफ़्ट का वादा करता है जिसमें आपने हिस्सा ही नहीं लिया।",
   "money_lure": "यह आसान कमाई, पक्के रिटर्न या पहले से मंज़ूर लोन का वादा करता है।",
   "bill_threat": "यह कहता है कि अभी भुगतान न किया तो बिजली/गैस कट जाएगी। असली बिल उसी कंपनी के ऐप में देखें।",
   "parcel": "यह ऐसे पार्सल या कस्टम शुल्क की बात करता है जिसकी आपको उम्मीद नहीं थी।",
   "fee": "यह पैसे या नौकरी देने से पहले अग्रिम शुल्क माँगता है।",
   "call_number": "यह किसी मोबाइल नंबर पर कॉल/WhatsApp करने को कहता है। आधिकारिक हेल्पलाइन निजी मोबाइल नंबर नहीं होती।",
   "fake_support": "यह 'कस्टमर केयर नंबर' देता है। नंबर ख़ुद आधिकारिक वेबसाइट पर खोजें।",
   "lookalike": "लिंक {host}, {brand} की नकल करता है पर उसकी असली साइट ({official}) नहीं है।",
   "shortener": "लिंक {host} असली पता छिपाता है।",
   "risky_tld": "लिंक {host} ऐसे डोमेन (.{tld}) पर है जो ठगी की साइटों में आम है।",
   "ip_host": "लिंक किसी असली वेबसाइट नहीं, सीधे IP पते पर जाता है।",
   "punycode": "लिंक {host} असली साइट की नकल के लिए मिलते-जुलते विदेशी अक्षर इस्तेमाल करता है।",
   "apk": "यह प्ले स्टोर के बाहर से ऐप फ़ाइल (.apk) डाउनलोड करने को कहता है। ऐसी फ़ाइलें अक्सर OTP और संदेश चुराती हैं।",
   "http": "लिंक {host} सुरक्षित नहीं है (https नहीं, http)।",
   "payment_screenshot": "यह पेमेंट का स्क्रीनशॉट लगता है। स्क्रीनशॉट भुगतान का सबूत नहीं है: सामान देने से पहले अपना बैंक/UPI ऐप, SMS या साउंडबॉक्स देखें।",
  },
  "do": {
   "scam": ["कोई लिंक न खोलें, कोई नंबर न मिलाएँ, कोई कोड साझा न करें।", "भेजने वाले को ब्लॉक करें।", "रिपोर्ट करें: sancharsaathi.gov.in पर Chakshu (कॉल, SMS और WhatsApp के लिए)।",
            "अगर पैसे भेज चुके हैं या OTP बता दिया है: तुरंत 1930 पर कॉल करें और cybercrime.gov.in पर शिकायत करें। देरी न करें।"],
   "suspicious": ["अभी पैसे न दें, कुछ साझा न करें।", "दावे की जाँच आधिकारिक ऐप/वेबसाइट पर करें, जिसे आप ख़ुद खोलें, इस संदेश से नहीं।", "संदेह हो तो इसे फिर SYNC को भेजें या पार्टनर से पूछें।"],
   "clear": ["फिर भी OTP/PIN किसी को न बताएँ।", "पैसे के लिए सिर्फ़ अपने बैंक/UPI ऐप पर भरोसा करें, स्क्रीनशॉट या संदेश पर नहीं।"],
   "shot": ["सामान देने से पहले UPI ऐप / बैंक SMS / साउंडबॉक्स में रक़म आई है, यह देख लें।", "'गलती से भेज दिए' वाली माँग पर कुछ न करें; कहें कि बैंक के ज़रिए रिफ़ंड करें।"],
  },
 },
}

URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"')]+|\b[a-z0-9][a-z0-9\-]*(?:\.[a-z0-9\-]+)*\.(?:com|in|net|org|xyz|top|click|icu|vip|cfd|sbs|buzz|co|apk|app|info|live|shop|site|online|link|me|gq|tk|ml|cf|ga)(?:/[^\s]*)?", re.I)


def _registrable(host: str) -> str:
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in SECOND_LEVEL and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def analyze_link(raw: str) -> dict:
    u = raw if re.match(r"https?://", raw, re.I) else "http://" + raw
    host = (urlparse(u).hostname or "").lower().strip(".")
    flags: list[tuple[str, dict]] = []
    if not host:
        return {"url": raw, "host": raw, "flags": []}
    reg = _registrable(host)
    tld = host.rsplit(".", 1)[-1]
    if re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host):
        flags.append(("ip_host", {}))
    if host.startswith("xn--") or ".xn--" in host:
        flags.append(("punycode", {"host": host}))
    if reg in SHORTENERS:
        flags.append(("shortener", {"host": host}))
    if tld in RISKY_TLD:
        flags.append(("risky_tld", {"host": host, "tld": tld}))
    label = host.replace("-", "").replace(".", "")
    for brand, doms in OFFICIAL.items():
        if brand in label and not any(reg == d or host.endswith("." + d) or host == d for d in doms):
            flags.append(("lookalike", {"host": host, "brand": brand.upper() if len(brand) <= 4 else brand.title(), "official": doms[0]}))
            break
    if u.lower().startswith("http://") and not any(f[0] in ("lookalike",) for f in flags) and (raw.lower().startswith("http://")):
        flags.append(("http", {"host": host}))
    if re.search(r"\.apk(\?|$|/)", u, re.I):
        flags.append(("apk", {}))
    return {"url": raw, "host": host, "flags": flags}


WEIGHT_LINK = {"lookalike": 55, "shortener": 18, "risky_tld": 26, "ip_host": 40, "punycode": 40, "apk": 45, "http": 8}


def analyze(text: str, lang: str = "en", from_screenshot: bool = False) -> dict:
    lang = lang if lang in TEXT else "en"
    L = TEXT[lang]
    t = text or ""
    low = t.lower()
    score, reasons, seen = 0, [], set()
    safe_note = re.search(r"(do not|don'?t|never)\W+(\w+\W+){0,3}share|कभी .* न बताएं|किसी को न बताएं", low)
    for code, pat, w, sev in SIGNALS:
        if re.search(pat, low, re.I):
            if code == "otp_ask" and safe_note and not re.search(r"(please|kindly|now|immediately)\W+(share|send)", low):
                continue
            score += w
            seen.add(code)
            reasons.append({"code": code, "severity": sev, "text": L["reasons"][code]})
    links = []
    for m in URL_RE.finditer(t):
        raw = m.group(0).rstrip(".,;:!?)")
        if raw.lower() in {"e.g", "i.e"} or "@" in t[max(0, m.start() - 1):m.start()]:
            continue
        info = analyze_link(raw)
        links.append({"url": raw, "host": info["host"], "flags": [f[0] for f in info["flags"]]})
        for code, kw in info["flags"]:
            score += WEIGHT_LINK.get(code, 10)
            seen.add(code)
            reasons.append({"code": code, "severity": "high" if WEIGHT_LINK.get(code, 0) >= 26 else "med", "text": L["reasons"][code].format(**{**{"host": "", "tld": "", "brand": "", "official": ""}, **kw})})
    shot = bool(PAY_SHOT.search(t)) or (from_screenshot and bool(re.search(r"₹|rs\.?\s*\d|upi|paid", low)))
    if shot:
        reasons.append({"code": "payment_screenshot", "severity": "info", "text": L["reasons"]["payment_screenshot"]})
        if "wrong_transfer" in seen or "collect" in seen:
            score += 15
    if len({c for c in seen if c in ("urgency", "kyc_threat", "otp_ask", "prize")}) >= 2:
        score += 12  # combos are much riskier than single words
    score = min(score, 100)
    verdict = "scam" if score >= 55 else "suspicious" if score >= 24 else "clear"
    shot_only = shot and verdict == "clear"
    if shot_only:
        verdict = "suspicious"
    order = {"high": 0, "med": 1, "info": 2}
    reasons.sort(key=lambda r: order[r["severity"]])
    actions = list(L["do"][verdict]) + (L["do"]["shot"] if shot else [])
    label, advice = L["labels"][verdict], L["advice"][verdict]
    if shot_only:
        label = "Not proof of payment" if lang == "en" else "भुगतान का सबूत नहीं"
        advice = "A screenshot can be faked. Check your bank/UPI app first." if lang == "en" else "स्क्रीनशॉट नकली हो सकता है। पहले अपना बैंक/UPI ऐप देखें।"
    return {"verdict": verdict, "label": label, "advice": advice, "score": score, "reasons": reasons,
            "links": links, "actions": actions, "payment_screenshot": shot, "lang": lang}


def format_text(res: dict) -> str:
    icon = {"scam": "🚨", "suspicious": "⚠️", "clear": "🔎"}[res["verdict"]]
    out = [f"{icon} *{res['label']}* (risk {res['score']}/100)", res["advice"]]
    if res["reasons"]:
        out.append("")
        out += [f"• {r['text']}" for r in res["reasons"][:5]]
    out.append("")
    out += [f"{i+1}. {a}" for i, a in enumerate(res["actions"][:4])]
    return "\n".join(out)
