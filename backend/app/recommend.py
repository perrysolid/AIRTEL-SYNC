"""Rules-based bundle recommender: the LLM proposes slots, the rules dispose.
Every recommendation respects catalogue eligibility and dependencies, so it can never promise something we cannot sell."""
from __future__ import annotations
import re
from .catalogue import Profile, eligibility, build_quote, price_point
from .data import PRODUCTS, leads

SEGMENT_NAMES = {"micro": "Micro retail & services", "prof": "Professional offices",
                 "multi": "Small multi-site business", "mfg": "Small manufacturer"}
_SEG_FROM_CSV = {"Micro retail & services": "micro", "Professional offices": "prof",
                 "Small multi-site businesses": "multi", "Small manufacturers": "mfg"}
TYPE_TO_SEGMENT = {t.lower(): _SEG_FROM_CSV[s] for t, s in leads.groupby("business_type").segment.first().items()}
RETAIL_TYPES = {"kirana store", "pharmacy", "bakery", "sweet shop", "hardware store", "stationery shop", "boutique",
                "optician", "mobile repair shop", "electronics retail chain", "pharmacy chain", "apparel retail chain",
                "bakery chain", "restaurant chain"}

# keyword -> canonical business type (English + Hindi/Hinglish)
KEYWORDS: list[tuple[str, str]] = [
    (r"kirana|किराना|grocery|general store|provision", "Kirana store"), (r"salon|सैलून|parlou?r|barber|beauty", "Salon"),
    (r"pharmacy chain|medical stores", "Pharmacy chain"), (r"pharmacy|medical store|chemist|दवा|मेडिकल", "Pharmacy"),
    (r"bakery chain", "Bakery chain"), (r"bakery|बेकरी", "Bakery"), (r"sweet|मिठाई|mithai", "Sweet shop"),
    (r"hardware", "Hardware store"), (r"stationer", "Stationery shop"), (r"boutique|tailor|दर्जी", "Boutique"),
    (r"optician|eyewear|चश्मा", "Optician"), (r"mobile repair|phone repair|mobile shop", "Mobile repair shop"),
    (r"dental|dentist|दंत", "Dental clinic"), (r"physio", "Physiotherapy clinic"), (r"diagnostic|pathology|\blab\b|जांच", "Diagnostic lab"),
    (r"clinic|doctor|hospital|क्लिनिक|डॉक्टर|दवाखाना", "Dental clinic"),
    (r"\bca\b|chartered|accountant|tax consult|सीए", "CA firm"), (r"\blaw\b|advocate|lawyer|वकील", "Law office"),
    (r"coaching|tuition|classes|कोचिंग|institute", "Coaching centre"), (r"travel|tours|ट्रैवल", "Travel agency"),
    (r"architect", "Architecture studio"), (r"real estate|property|broker|रियल", "Real estate agency"),
    (r"insurance|बीमा", "Insurance agency"), (r"hotel|lodge|guest ?house|होटल", "Budget hotel group"),
    (r"restaurant|cafe|dhaba|रेस्टोरेंट|ढाबा|food court", "Restaurant chain"),
    (r"\bgym\b|fitness|जिम", "Gym chain"), (r"pre-?school|play ?school|daycare|नर्सरी", "Pre-school chain"),
    (r"electronics", "Electronics retail chain"), (r"apparel|garment shop|clothing", "Apparel retail chain"),
    (r"textile|weaving|कपड़ा मिल", "Textile unit"), (r"auto[- ]?parts|automobile parts", "Auto-parts unit"),
    (r"plastic|moulding|molding", "Plastic moulding unit"), (r"packag", "Packaging unit"), (r"print", "Printing press"),
    (r"furniture|carpent", "Furniture workshop"), (r"food process", "Food processing unit"),
    (r"factory|manufactur|फैक्ट्री|कारखान|workshop|plant|industrial", "Auto-parts unit"),
    (r"shop|store|दुकान|dukan|retail|showroom", "Kirana store"),
]


def canonical_type(text: str) -> str | None:
    t = text.lower()
    for pat, name in KEYWORDS:
        if re.search(pat, t):
            return name
    return None


def infer_segment(p: Profile) -> str:
    seg = TYPE_TO_SEGMENT.get(p.business_type.lower())
    if p.sites >= 3:
        return "multi"
    if seg == "multi" and p.sites < 3:
        seg = "prof" if p.employees > 6 else "micro"
    if seg:
        return seg
    if p.employees >= 12 and p.sites == 1:
        return "mfg"
    return "micro" if p.employees <= 6 else "prof"


NEED_LABELS = {
    "internet": "Reliable internet", "payments": "UPI / billing (POS)", "whatsapp": "WhatsApp for customers",
    "email": "Business email & cloud", "security": "Cyber-security", "cctv": "CCTV cameras", "backup": "Data backup",
    "website": "Website", "calls": "Business phone / IVR", "vehicles": "Vehicle tracking", "machines": "Machine monitoring",
    "uptime": "No-downtime failover", "guestwifi": "Customer Wi-Fi", "sms": "SMS alerts", "mobile": "Business SIMs",
}
NEED_KEYWORDS = {
    "internet": r"internet|wifi|wi-fi|broadband|fibre|fiber|इंटरनेट|वाईफाई",
    "payments": r"upi|\bpos\b|billing|bill\b|payment|gst bill|बिल|पेमेंट|यूपीआई|inventory|stock",
    "whatsapp": r"whats ?app|व्हाट्सएप|वॉट्सऐप|catalog",
    "email": r"e-?mail|cloud|office suite|google|ईमेल|storage",
    "security": r"security|virus|ransom|hack|firewall|सुरक्षा|cyber",
    "cctv": r"cctv|camera|कैमरा|surveillance",
    "backup": r"backup|back up|बैकअप|data loss",
    "website": r"website|web ?site|domain|वेबसाइट|online store",
    "calls": r"\bivr\b|call ?cent|telephon|landline|customer care|inbound|toll",
    "vehicles": r"vehicle|fleet|gps|truck|delivery|गाड़ी|वाहन|ट्रक",
    "machines": r"machine|\biot\b|sensor|energy|मशीन",
    "uptime": r"downtime|failover|never go down|always on|24x7|बंद न",
    "guestwifi": r"guest|customer wi-?fi|visitors",
    "sms": r"\bsms\b|alerts|promotional|एसएमएस",
    "mobile": r"\bsims?\b|mobile plan|postpaid|business number|सिम|phone plan",
}


def extract_needs(text: str) -> list[str]:
    t = text.lower()
    return [k for k, pat in NEED_KEYWORDS.items() if re.search(pat, t)]


def _qty(pid: str, p: Profile) -> int:
    e, s = max(p.employees, 1), max(p.sites, 1)
    if pid in ("P01", "P02", "P03", "P04", "P05", "P06", "P09", "P10", "P21", "P22"):
        return s
    if pid in ("P07", "P08"):
        return {"micro": min(e, 2), "prof": min(max(2, e // 3), 8), "multi": min(max(s, e // 8), 12),
                "mfg": min(max(2, e // 12), 8)}[p.segment]
    if pid in ("P16", "P20"):
        return min(e, 25) if p.segment in ("prof", "mfg") else min(e, 3 * s, 25)
    if pid == "P19":
        return max(1, s if p.segment == "multi" else 1)
    if pid == "P23":
        return {"micro": 2, "prof": 3, "multi": 2 * s, "mfg": 6}[p.segment]
    if pid == "P24":
        return 5
    if pid == "P25":
        return 2
    if pid == "P12":
        return max(3, min(e // 4, 10))
    return 1


WHY = {
    "P01": "Fixed fibre gives you a steady connection for billing, UPI and video calls at a flat monthly price.",
    "P02": "300 Mbps handles a whole team on cloud tools and video calls without slowing down.",
    "P03": "1 Gbps with priority support for heavy data or many users.",
    "P04": "No fibre needed: plug-and-play 5G that is working in about 2 days, with a light commitment (from 6 months).",
    "P05": "A dedicated, uncontended line with a 99.5% uptime commitment for production and ERP access.",
    "P06": "100 Mbps dedicated line with 99.9% SLA for large teams and heavy workloads.",
    "P07": "Business SIMs with 50 GB data and unlimited calls, on the same bill as your internet.",
    "P08": "150 GB, roaming and priority care for people who are on the road.",
    "P09": "If the main link drops, a 4G/5G backup takes over automatically so sales and billing never stop.",
    "P10": "One dashboard to manage every site's internet and prioritise billing/ERP traffic.",
    "P11": "A fixed public IP so you can view CCTV or reach servers remotely.",
    "P12": "Professional phone lines with IVR and call recording, so no customer call is missed.",
    "P13": "A 1800 number customers trust, routed to any phone.",
    "P14": "Appointment reminders and offers to customers by SMS (DLT registration handled for you).",
    "P15": "Take orders and send your catalogue on the app your customers already use.",
    "P16": "Professional email on your own domain with documents and video meetings.",
    "P17": "Automatic backup of PCs and phones; protects your records if a device is lost or hit by ransomware.",
    "P18": "Your own domain and a ready 5-page website, so customers can find you on Google.",
    "P19": "GST-ready billing, stock and UPI/card payments on one tablet, with no separate vendor.",
    "P20": "Antivirus and ransomware protection on every PC and phone.",
    "P21": "A managed firewall watched by the Accel security team; protects customer and billing data.",
    "P22": "Separate Wi-Fi for customers so your billing systems stay private.",
    "P23": "HD cameras with 30-day cloud recording; watch your shop from your phone.",
    "P24": "Sensors that show machine uptime and energy use so you can cut downtime.",
    "P25": "Live location and trip history for each vehicle.",
}
NEED_TO_PID = {"payments": ["P19"], "whatsapp": ["P15"], "email": ["P16"], "security": ["P20"], "cctv": ["P23"],
               "backup": ["P17"], "website": ["P18"], "calls": ["P12"], "vehicles": ["P25"], "machines": ["P24"],
               "uptime": ["P09"], "guestwifi": ["P22"], "sms": ["P14"], "mobile": ["P07"]}


def _connectivity(p: Profile) -> str:
    if p.force_conn:
        return p.force_conn
    seg, e = p.segment, p.employees
    hot = p.current_internet.lower() in ("mobile hotspot", "none", "")
    if seg == "micro":
        return "P04" if hot else "P01"
    if seg == "prof":
        if p.has_gstin and p.city_tier == 1 and e >= 20:
            return "P03"     # 1 Gbps with priority support: Tier-1, GSTIN, 5+ people (catalogue rules)
        return "P01" if e <= 10 else "P02"
    if seg == "multi":
        return "P02"
    if p.has_gstin and e >= 100:
        return "P06"
    if p.has_gstin and e >= 10:
        return "P05"
    return "P02"


def _lock(pid: str, el: dict) -> dict:
    return {"product_id": pid, "name": PRODUCTS[pid]["product_name"], "blockers": el["blockers"], "reason": WHY[pid]}


def recommend(p: Profile) -> dict:
    p.segment = p.segment or infer_segment(p)
    seg = p.segment
    needs = set(p.needs)
    conn = _connectivity(p)
    core: list[str] = [conn]
    addons: list[str] = []
    if seg == "micro":
        core += ["P07"]
        addons += ["P19", "P15", "P23", "P22", "P18", "P14"]
        if p.business_type.lower() in RETAIL_TYPES:
            core.append("P19")
    elif seg == "prof":
        core += ["P07", "P16", "P20"]
        addons += ["P17", "P22", "P23", "P15", "P12", "P14", "P18", "P21", "P11"]
    elif seg == "multi":
        core += ["P09", "P07"]
        if p.business_type.lower() in RETAIL_TYPES:
            core.append("P19")
        addons += ["P10", "P23", "P21", "P15", "P20", "P16", "P22", "P13", "P25", "P12"]
    else:
        core += ["P08", "P21"]
        addons += ["P24", "P25", "P16", "P20", "P23", "P11", "P09", "P17"]
    for n in needs:
        for pid in NEED_TO_PID.get(n, []):
            if pid in addons:
                addons.remove(pid)
            if pid not in core:
                core.append(pid)
    core = list(dict.fromkeys(core))
    addons = [a for a in dict.fromkeys(addons) if a not in core]

    chosen: set[str] = set()
    items, locked = [], []
    # connectivity first so dependencies resolve
    for pid in sorted(core, key=lambda x: PRODUCTS[x]["category"] != "Connectivity"):
        el = eligibility(pid, p, chosen | {conn})
        if el["ok"]:
            chosen.add(pid)
            items.append({"product_id": pid, "qty": _qty(pid, p), "selected": True, "tag": "core", "reason": WHY[pid]})
        else:
            locked.append(_lock(pid, el))
    if not (chosen & {"P01", "P02", "P03", "P04", "P05", "P06"}):
        alt = "P02" if seg != "micro" else "P01"
        chosen.add(alt)
        items.insert(0, {"product_id": alt, "qty": _qty(alt, p), "selected": True, "tag": "core", "reason": WHY[alt]})
        # dependants that failed only for the dependency can now be offered again
        again = [l for l in locked if all(b["code"] == "dependency" for b in l["blockers"])]
        for l in again:
            locked.remove(l)
            items.append({"product_id": l["product_id"], "qty": _qty(l["product_id"], p), "selected": True, "tag": "core",
                          "reason": WHY[l["product_id"]]})
            chosen.add(l["product_id"])
    for pid in addons:
        el = eligibility(pid, p, chosen)
        if el["ok"]:
            items.append({"product_id": pid, "qty": _qty(pid, p), "selected": False, "tag": "addon", "reason": WHY[pid]})
        elif any(b["code"] in ("gstin", "min_employees", "min_sites") for b in el["blockers"]):
            locked.append(_lock(pid, el))
    items.sort(key=lambda i: (i["tag"] != "core", PRODUCTS[i["product_id"]]["category"] != "Connectivity"))
    for i in items:
        i["unit_price"] = price_point(i["product_id"], 12)[0]
        i["unit"] = PRODUCTS[i["product_id"]]["unit"]
        i["name"] = PRODUCTS[i["product_id"]]["product_name"]
    sel = [{"product_id": i["product_id"], "qty": i["qty"]} for i in items if i["selected"]]
    quote = build_quote(sel, 12, p.monthly_spend)
    gst_unlocks = [l for l in locked if any(b["code"] == "gstin" for b in l["blockers"])]
    assist = []
    if any(i["product_id"] in ("P05", "P06", "P10") for i in items if i["selected"]):
        assist.append("Dedicated links and SD-WAN need a site survey; a field engineer will join a short video call.")
    if p.sites >= 6:
        assist.append("With 6+ sites, an Accel partner can coordinate installs on the ground.")
    return {
        "segment": seg, "segment_name": SEGMENT_NAMES[seg], "items": items, "locked": locked, "quote": quote,
        "gstin_unlock_count": len(gst_unlocks), "assist": assist,
        "headline": f"{p.business_name or 'Your business'}: one bundle, one bill, Rs {quote['monthly_total']:,}/month incl. GST",
        "profile": p.__dict__,
    }
