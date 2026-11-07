"""Conversational needs-discovery advisor.

Works fully offline (rule-based slot filling in 10 languages). If ANTHROPIC_API_KEY is set, Claude is used to
(a) extract slots from free text and (b) answer open questions grounded in the catalogue. The recommendation itself
always comes from the deterministic rules engine, so it can never break eligibility."""
from __future__ import annotations
import re, uuid, os
from .catalogue import Profile
from .data import PRODUCTS, CITY_TIER
from .i18n import t, WHY_HI, LANGS
from .recommend import canonical_type, extract_needs, recommend, infer_segment, NEED_LABELS
from . import kyc

SESSIONS: dict[str, dict] = {}
ORDER = ["type", "city", "size", "net", "needs", "gst"]

CITY_ALIASES = {"bangalore": "Bengaluru", "bombay": "Mumbai", "madras": "Chennai", "calcutta": "Kolkata", "poona": "Pune",
                "vizag": "Visakhapatnam", "baroda": "Vadodara", "mysore": "Mysuru", "cochin": "Kochi", "new delhi": "Delhi",
                "बेंगलुरु": "Bengaluru", "मुंबई": "Mumbai", "दिल्ली": "Delhi", "पुणे": "Pune", "जयपुर": "Jaipur", "लखनऊ": "Lucknow",
                "इंदौर": "Indore", "भोपाल": "Bhopal", "पटना": "Patna", "नागपुर": "Nagpur", "नासिक": "Nashik", "सूरत": "Surat",
                "अहमदाबाद": "Ahmedabad", "कोलकाता": "Kolkata", "चेन्नई": "Chennai", "हैदराबाद": "Hyderabad", "लुधियाना": "Ludhiana"}

CHIPS = {
    "type": {"en": ["Kirana store", "Salon", "Pharmacy", "Clinic", "CA / Law office", "Coaching centre", "Restaurant chain", "Factory"],
             "hi": ["किराना दुकान", "सैलून", "मेडिकल स्टोर", "क्लिनिक", "CA / वकील", "कोचिंग", "रेस्टोरेंट चेन", "फैक्ट्री"]},
    "net": {"en": ["Mobile hotspot", "Home broadband", "Business broadband", "Leased line", "Nothing yet"],
            "hi": ["मोबाइल हॉटस्पॉट", "होम ब्रॉडबैंड", "बिज़नेस ब्रॉडबैंड", "लीज़्ड लाइन", "अभी कुछ नहीं"]},
    "needs": {"en": ["internet", "payments", "whatsapp", "email", "security", "cctv", "backup", "website", "calls", "sms", "vehicles", "machines"]},
    "gst": {"en": ["Yes, I have GSTIN", "No GSTIN"], "hi": ["हाँ, GSTIN है", "GSTIN नहीं है"]},
}
CHIP_VALUE = {"Clinic": "Dental clinic", "क्लिनिक": "Dental clinic", "CA / Law office": "CA firm", "CA / वकील": "CA firm",
              "Coaching centre": "Coaching centre", "कोचिंग": "Coaching centre", "Factory": "Auto-parts unit", "फैक्ट्री": "Auto-parts unit",
              "मेडिकल स्टोर": "Pharmacy", "किराना दुकान": "Kirana store", "सैलून": "Salon", "रेस्टोरेंट चेन": "Restaurant chain",
              "Mobile hotspot": "hotspot", "मोबाइल हॉटस्पॉट": "hotspot", "Home broadband": "home", "होम ब्रॉडबैंड": "home",
              "Business broadband": "business", "बिज़नेस ब्रॉडबैंड": "business", "Leased line": "leased", "लीज़्ड लाइन": "leased",
              "Nothing yet": "none", "अभी कुछ नहीं": "none"}
SEGMENT_HI = {"micro": "आपकी दुकान", "prof": "आपका ऑफ़िस/क्लिनिक", "multi": "आपके सभी आउटलेट", "mfg": "आपकी फैक्ट्री"}
NEED_HI = {"internet": "इंटरनेट", "payments": "UPI / बिलिंग", "whatsapp": "WhatsApp", "email": "ईमेल / क्लाउड", "security": "सुरक्षा",
           "cctv": "CCTV", "backup": "बैकअप", "website": "वेबसाइट", "calls": "फ़ोन / IVR", "sms": "SMS", "vehicles": "वाहन ट्रैकिंग", "machines": "मशीन मॉनिटरिंग"}

HUMAN_RE = re.compile(r"human|real person|agent|sales ?(man|person|executive)|call me|talk to (a )?(person|someone)|representative|इंसान|आदमी|एजेंट|कॉल करो|बात करवा", re.I)
NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5}


def new_session(lang: str = "en", channel: str = "web", phone: str | None = None) -> dict:
    sid = uuid.uuid4().hex[:10]
    s = {"id": sid, "lang": lang if lang in LANGS else "en", "channel": channel, "phone": phone,
         "slots": {}, "needs": [], "stage": "type", "fails": 0, "messages": [], "reco": None, "handoff": None, "gst_info": None}
    SESSIONS[sid] = s
    _say(s, t(s["lang"], "greet"))
    _ask(s)
    return s


def _say(s: dict, text: str, **extra):
    s["messages"].append({"role": "advisor", "text": text, **extra})


def _chips(s: dict, stage: str):
    lang = "hi" if s["lang"] == "hi" else "en"
    c = CHIPS.get(stage)
    if not c:
        return None
    if stage == "needs":
        lab = (lambda k: NEED_HI[k]) if lang == "hi" else (lambda k: NEED_LABELS[k])
        return {"multi": True, "options": [{"label": lab(k), "value": k} for k in c["en"]],
                "extra": [{"label": t(s["lang"], "done"), "value": "__done__"}]}
    return {"multi": False, "options": [{"label": x, "value": CHIP_VALUE.get(x, x)} for x in c.get(lang, c["en"])]}


def _ask(s: dict):
    st = s["stage"]
    if st == "done":
        return
    q = {"type": "ask_type", "city": "ask_city", "size": "ask_size", "net": "ask_net", "needs": "ask_needs", "gst": "ask_gst"}[st]
    ch = _chips(s, st)
    _say(s, t(s["lang"], q), chips=ch, stage=st)


# ------------------ extraction ------------------
def _num(text: str) -> int | None:
    m = re.search(r"\d[\d,]*", text)
    if m:
        return int(m.group(0).replace(",", ""))
    for w, n in NUM_WORDS.items():
        if re.search(rf"\b{w}\b", text.lower()):
            return n
    return None


def extract(text: str, stage: str, s: dict) -> dict:
    out: dict = {}
    tl = text.lower().strip()
    ty = canonical_type(text)
    if ty:
        out["business_type"] = ty
    for alias, city in CITY_ALIASES.items():
        if alias in tl:
            out["city"] = city
    for city in CITY_TIER:
        if city.lower() in tl:
            out["city"] = city
    m = re.search(r"(\d[\d,]*)\s*(employees?|staff|people|persons?|workers?|members?|logo?n?|लोग|कर्मचारी|स्टाफ|कामगार|आदमी)", tl)
    if m:
        out["employees"] = int(m.group(1).replace(",", ""))
    m = re.search(r"(\d+)\s*(branch(es)?|outlets?|stores?|shops?|sites?|locations?|centres?|centers?|dukan|दुकान(ें)?|शाखा(एं)?|ब्रांच|जगह)", tl)
    if m:
        out["sites"] = int(m.group(1))
    if re.search(r"\b(single|only one|one)\s+(shop|store|branch|outlet|location|site)\b|सिर्फ़? एक|एक ही दुकान", tl):
        out["sites"] = 1
    if stage == "size" and "employees" not in out:
        nums = [int(x.replace(",", "")) for x in re.findall(r"\d[\d,]*", text)]
        if len(nums) >= 2:
            out["employees"], out["sites"] = nums[0], nums[1]
        elif len(nums) == 1 and "sites" not in out:
            out["employees"] = nums[0]
        elif not nums and _num(text):
            out["employees"] = _num(text)
    if re.search(r"hotspot|हॉटस्पॉट|mobile data|phone data|jio ?fi", tl) or tl == "hotspot":
        out["current_internet"] = "Mobile hotspot"
    elif re.search(r"home|घर|\bhome\b", tl) or tl == "home":
        out["current_internet"] = "Home broadband"
    elif re.search(r"leased|लीज़्?ड?|dedicated", tl) or tl == "leased":
        out["current_internet"] = "Leased line"
    elif re.search(r"business broadband|office broadband|fibre|fiber|broadband|ब्रॉडबैंड", tl) or tl == "business":
        out["current_internet"] = "Business broadband"
    elif re.search(r"nothing|none|no internet|कुछ नहीं|abhi nahi", tl) or tl == "none":
        out["current_internet"] = "Mobile hotspot"
    m = re.search(r"(?:₹|rs\.?|inr)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:rs|rupees|रुपये|रुपए|/-|per month|a month|monthly|महीने)", tl)
    if m:
        out["spend"] = int((m.group(1) or m.group(2)).replace(",", ""))
    g = re.search(r"\b\d{2}[A-Z0-9]{13}\b", text.upper().replace(" ", ""))
    if g:
        out["gstin"] = g.group(0)
    elif stage == "gst":
        if re.search(r"^(yes|y|haan|han|ha|हाँ|हां|है|have)|yes", tl) or "i have" in tl:
            out["gst_yes"] = True
        elif re.search(r"^(no|n|nahi|nahin|नहीं|नही)|no gst|don'?t|nahi|नहीं", tl):
            out["gst_no"] = True
    nd = extract_needs(text)
    if nd:
        out["needs"] = nd
    return out


def _llm_extract(text: str, stage: str):
    """Optional Claude-based extraction for messy / multilingual free text."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return {}
    try:
        from .llm import extract_slots
        return extract_slots(text, stage)
    except Exception:
        return {}


# ------------------ FAQ ------------------
def faq(text: str, lang: str) -> str | None:
    tl = text.lower()
    for pid, pr in PRODUCTS.items():
        name = pr["product_name"].lower()
        if name in tl or pid.lower() in tl.split():
            gst = "needs a GSTIN" if pr["requires_gstin"] == "Y" else "no GSTIN needed"
            return (f"{pr['product_name']} ({pr['unit']}): Rs {int(pr['price_min_inr_per_month']):,}–{int(pr['price_max_inr_per_month']):,}/month, "
                    f"{pr['min_contract_months']}-month minimum, setup Rs {int(pr['one_time_setup_inr']):,}, usually live in {pr['typical_install_days']} days, {gst}. "
                    f"{pr['description']}.")
    if re.search(r"lock.?in|contract|commit", tl):
        return "Contracts are 1–24 months depending on the product. The longer you commit, the lower the price: 24 months gets the lowest price, 12 months the midpoint."
    if re.search(r"how long|install|activate|kitna time|कितना समय|कब तक", tl):
        return "Most products go live in 1–5 days; dedicated links take 3–4 weeks because a site survey is needed. You'll see your exact ETA in the tracker, no calls needed."
    if re.search(r"gst|invoice|tax", tl) and "gstin" not in tl:
        return "All prices are shown before GST; 18% GST is added at checkout and you get one consolidated GST invoice."
    if re.search(r"data|privacy|safe|सुरक्षित|dpdp", tl):
        return "We only collect what each step needs, ask for your consent first, mask your numbers on screen and delete uploaded documents after verification (see the consent screen)."
    return None


# ------------------ flow ------------------
def _profile(s: dict) -> Profile:
    sl = s["slots"]
    p = Profile(business_name=sl.get("business_name", ""), business_type=sl.get("business_type", ""), city=sl.get("city", ""),
                city_tier=CITY_TIER.get(sl.get("city", ""), 2), employees=sl.get("employees", 3), sites=sl.get("sites", 1),
                has_gstin=sl.get("has_gstin"), gstin_active=sl.get("gstin_active"), current_internet=sl.get("current_internet", ""),
                monthly_spend=sl.get("spend", 0), needs=s["needs"], language=s["lang"])
    p.segment = infer_segment(p)
    return p


def _complete(s: dict, st: str) -> bool:
    sl = s["slots"]
    return {"type": "business_type" in sl, "city": "city" in sl, "size": "employees" in sl, "net": "current_internet" in sl or sl.get("net_skipped"),
            "needs": s.get("needs_done"), "gst": "has_gstin" in sl}[st]


def handoff(s: dict, reason: str) -> dict:
    from . import ops
    s["stage"] = "handoff"
    h = ops.create_handoff(s, reason)
    s["handoff"] = h
    _say(s, t(s["lang"], "handoff"), handoff=h)
    return s


def handle(sid: str, text: str, value: str | None = None) -> dict:
    s = SESSIONS[sid]
    lang = s["lang"]
    text = (text or "").strip()
    s["messages"].append({"role": "user", "text": text})
    if s["stage"] in ("handoff", "done_reco") and not HUMAN_RE.search(text):
        ans = faq(text, lang)
        if ans:
            _say(s, ans)
        elif s["stage"] == "done_reco":
            _say(s, t(lang, "noted"))
        return s
    if HUMAN_RE.search(text) or value == "__human__":
        return handoff(s, "customer_asked_for_human")
    st = s["stage"]
    ans = faq(text, lang) if st != "gst" and not _looks_like_answer(text, st) else None
    ex = extract(text, st, s)
    if (not ex or (st == "type" and "business_type" not in ex)) and os.getenv("ANTHROPIC_API_KEY"):
        ex = {**_llm_extract(text, st), **ex}
    if ans:
        _say(s, ans)
    sl = s["slots"]
    progressed = False
    if "business_type" in ex:
        sl["business_type"] = ex["business_type"]; progressed = True
    if "city" in ex:
        sl["city"] = ex["city"]; progressed = True
    if "employees" in ex:
        sl["employees"] = max(1, ex["employees"]); progressed = True
    if "sites" in ex:
        sl["sites"] = max(1, ex["sites"]); progressed = True
    if "current_internet" in ex:
        sl["current_internet"] = ex["current_internet"]; progressed = True
    if "spend" in ex:
        sl["spend"] = ex["spend"]; progressed = True
    if "needs" in ex:
        s["needs"] = sorted(set(s["needs"]) | set(ex["needs"])); progressed = True
    if st == "needs":
        if value == "__done__" or re.search(r"^(done|that'?s all|bas|बस|nothing|skip|no)\b|बस यही|\b(that is all)\b", text.lower()):
            s["needs_done"] = True; progressed = True
        elif "needs" in ex and not s.get("multi_open"):
            s["needs_done"] = True
        if value and value not in ("__done__",) and value in NEED_LABELS:
            s["needs"] = sorted(set(s["needs"]) | {value}); progressed = True
    if st == "net" and not progressed:
        if re.search(r"skip|don'?t know|पता नहीं|छोड़", text.lower()) or value == "__skip__":
            sl["net_skipped"] = True; progressed = True
    if "gstin" in ex:
        _apply_gstin(s, ex["gstin"]); progressed = True
    elif ex.get("gst_yes"):
        sl["has_gstin"] = True; sl["gstin_active"] = None; progressed = True
    elif ex.get("gst_no"):
        sl["has_gstin"] = False; progressed = True
    if "city" in sl and sl["city"] not in CITY_TIER and not sl.get("city_note"):
        sl["city_note"] = True
        _say(s, t(lang, "city_unknown", city=sl["city"]))
    if st == "city" and "city" not in sl and text and len(text) < 30 and not ex:
        sl["city"] = text.title(); progressed = True   # unknown city accepted as typed
    if "employees" not in sl and "sites" in sl and st == "size":
        sl["employees"] = max(3, sl["sites"] * 5)
    if not progressed:
        s["fails"] += 1
        if s["fails"] >= 3:
            return handoff(s, "advisor_could_not_understand")
        if not ans:
            _say(s, t(lang, "retry"))
            _ask(s)
        return s
    s["fails"] = 0
    # advance
    for nxt in ORDER:
        if not _complete(s, nxt):
            s["stage"] = nxt
            break
    else:
        s["stage"] = "done_reco"
    if s["stage"] == "done_reco":
        _finish(s)
    else:
        _ask(s)
    return s


def _looks_like_answer(text: str, stage: str) -> bool:
    return len(text.split()) <= 3 and stage in ("type", "city", "size", "net", "gst")


def _apply_gstin(s: dict, g: str):
    lang = s["lang"]
    res = kyc.lookup_gstin(g)
    sl = s["slots"]
    if res.get("found") and res.get("status") == "Active" and res.get("checksum_ok"):
        sl.update(has_gstin=True, gstin_active=True, gstin=g, business_name=res["trade_name"])
        sl.setdefault("city", None)
        if not sl.get("city"):
            sl.pop("city", None)
        s["gst_info"] = {"masked": kyc.mask(g), "name": res["trade_name"], "status": "Active", "address": res["address"], "state": res["state"]}
        _say(s, t(lang, "gst_ok", name=res["trade_name"]))
    else:
        why = ("invalid check digit" if not res.get("checksum_ok") else "not found" if not res.get("found") else f"status: {res.get('status')}")
        sl.update(has_gstin=False, gstin_active=False)
        _say(s, t(lang, "gst_bad", why=why))


def _finish(s: dict):
    lang = s["lang"]
    p = _profile(s)
    reco = recommend(p)
    if lang == "hi":
        for it in reco["items"]:
            it["reason"] = WHY_HI.get(it["product_id"], it["reason"])
    elif lang != "en" and os.getenv("ANTHROPIC_API_KEY"):
        try:
            from .llm import translate_reasons
            translate_reasons(reco["items"], lang)
        except Exception:
            pass
    s["reco"] = reco
    if not s["slots"].get("has_gstin") and reco["gstin_unlock_count"]:
        _say(s, t(lang, "gst_none", n=reco["gstin_unlock_count"]))
    seg_name = SEGMENT_HI.get(reco["segment"], reco["segment_name"]) if lang == "hi" else reco["segment_name"]
    _say(s, t(lang, "reco", name=reco["profile"]["business_name"] or seg_name), reco=reco)
    s["stage"] = "done_reco"


def public(s: dict) -> dict:
    return {k: s[k] for k in ("id", "lang", "channel", "stage", "messages", "reco", "handoff", "slots", "needs", "gst_info")}
