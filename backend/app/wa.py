"""SYNC on WhatsApp: the whole customer lifecycle in one chat.

discover -> bundle -> KYC photos -> e-sign -> order -> schedule install -> status -> troubleshoot -> open a branch,
plus Scam Shield (forward any message/screenshot) and Network Reality Check.
Channel-agnostic: returns [{text, quick:[{label, send}]}]; /api/whatsapp/webhook adapts it to Twilio."""
from __future__ import annotations
import re
from . import advisor, kyc, network, orders, scam
from .data import CITY_TIER, PRODUCTS

S: dict[str, dict] = {}
URL_ANY = re.compile(r"https?://|www\.|\b[a-z0-9-]+\.(com|in|xyz|top|click|apk|app|net|org)\b", re.I)
DEVANAGARI = re.compile(r"[ऀ-ॿ]")
DOC_LABEL = {"gst": "GST certificate", "udyam": "Udyam certificate", "id": "signatory ID", "address": "address proof"}

MENU = {
    "en": [("buy", "🛒 Get a bundle"), ("shield", "🛡️ Check a suspicious message"), ("network", "📡 Is my area covered?"),
           ("status", "📦 Track my order"), ("fix", "🔧 Fix a problem"), ("branch", "🏪 Open a new branch")],
    "hi": [("buy", "🛒 बंडल चुनें"), ("shield", "🛡️ संदिग्ध संदेश जाँचें"), ("network", "📡 क्या मेरे इलाके में सेवा है?"),
           ("status", "📦 मेरा ऑर्डर ट्रैक करें"), ("fix", "🔧 समस्या ठीक करें"), ("branch", "🏪 नई ब्रांच खोलें")],
}
GREET = {"en": "Namaste! I'm *Sync* from Accel Business. What would you like to do? Reply with a number.",
         "hi": "नमस्ते! मैं Accel Business का *सिंक* हूँ। आप क्या करना चाहेंगे? नंबर भेजें।"}


def _st(phone: str) -> dict:
    return S.setdefault(phone, {"lang": "en", "mode": None, "sid": None, "opts": [], "docs": {}, "order": None, "tmp": {}})


def _m(text: str, quick: list | None = None) -> dict:
    return {"text": text, "quick": [{"label": q, "send": q} if isinstance(q, str) else q for q in (quick or [])]}


def _menu(st: dict) -> list[dict]:
    lang = st["lang"]
    st.update(mode="menu", opts=[k for k, _ in MENU[lang]])
    body = GREET[lang] + "\n\n" + "\n".join(f"{i+1}. {l}" for i, (_, l) in enumerate(MENU[lang]))
    return [_m(body, [{"label": l, "send": str(i + 1)} for i, (_, l) in enumerate(MENU[lang])])]


def _order(phone: str) -> str | None:
    mine = [o for o in orders.ORDERS.values() if o["customer"].get("phone") == phone]
    # never expose another customer's order: fall back only to demo orders that carry no phone number
    pool = mine or [o for o in orders.ORDERS.values() if not o["customer"].get("phone")]
    return pool[-1]["id"] if pool else None


def render_advisor(msgs: list[dict]) -> list[dict]:
    out = []
    for m in msgs:
        if m["role"] != "advisor":
            continue
        txt, quick = m["text"], []
        if m.get("chips") and m["chips"]["options"]:
            txt += "\n" + "\n".join(f"{i+1}. {o['label']}" for i, o in enumerate(m["chips"]["options"]))
            quick = [{"label": o["label"], "send": str(i + 1)} for i, o in enumerate(m["chips"]["options"])][:8]
        if m.get("reco"):
            q = m["reco"]["quote"]
            lines = [f"• {l['name']} ×{l['qty']}  ₹{l['monthly']:,}" for l in q["lines"]]
            txt += ("\n\n" + "\n".join(lines) + f"\n\n*₹{q['monthly_total']:,}/month incl. GST* (setup ₹{q['setup_total']:,}, {q['contract_months']}-month plan, one bill)."
                    "\nReply *BUY* to continue here on WhatsApp.")
            quick = ["BUY", "Talk to a person"]
        out.append(_m(txt, quick))
    return out


def _chip_value(st: dict, s: dict, text: str):
    """Map a numeric reply onto the advisor's last chip options."""
    if text.isdigit():
        last = next((m for m in reversed(s["messages"]) if m["role"] == "advisor" and m.get("chips")), None)
        if last and 1 <= int(text) <= len(last["chips"]["options"]):
            o = last["chips"]["options"][int(text) - 1]
            return (o["value"] if o["value"] != "__done__" else "done"), o["value"]
    return text, None


def _ocr_plain(img: bytes) -> str:
    from PIL import Image
    import io, numpy as np
    with kyc.OCR_LOCK:
        res, _ = kyc._engine()(np.array(Image.open(io.BytesIO(img)).convert("RGB")))
    return "\n".join(r[1] for r in (res or []))


# ----------------------------------------------------------------- features
def _shield(st: dict, text: str, image: bytes | None) -> list[dict]:
    if image:
        try:
            txt = _ocr_plain(image)
        except Exception:
            return [_m("I could not open that file. Please send a screenshot or photo (JPG/PNG), or paste the text.")]
        if not txt.strip():
            return [_m("I couldn't read any text in that picture. Try a clearer screenshot, or type/paste the message.")]
        res = scam.analyze(txt, st["lang"], from_screenshot=True)
    else:
        res = scam.analyze(text, st["lang"])
    return [_m(scam.format_text(res) + "\n\nForward me another one anytime, or reply MENU.", ["MENU"])]


def _network(st: dict, text: str) -> list[dict]:
    pin = re.search(r"\b[1-9]\d{5}\b", text)
    if not pin:
        st["mode"] = "network"
        return [_m("Send the 6-digit pincode of your shop (and city), e.g. *Pune 411016*.", ["Pune 411016", "Kochi 682001"])]
    city = next((c for c in CITY_TIER if c.lower() in text.lower()), None)
    r = network.check(pin.group(0), city)
    lines = [f"{'✅' if o['available'] else '❌'} {o['name']} — {o['install_days']} days" for o in r["options"][:2]]
    return [_m(f"📡 *Network Reality Check* for {pin.group(0)}{' (' + city + ')' if city else ''}\n" + "\n".join(lines) + "\n\n" + r["message"] +
               "\n\n(Coverage is simulated in this demo.)\nSend another pincode or reply MENU.", ["MENU"])]


def _status(st: dict, phone: str) -> list[dict]:
    oid = _order(phone)
    if not oid:
        return [_m("You don't have an order yet. Reply *1* to build your bundle.", ["1"])]
    v = orders.view(oid)
    cur = v["current"]["title"] if v["current"] else "Live ✓"
    slot = f"\nInstall slot: {v['slot']['label']}" if v["slot"] else "\nNo install slot yet. Reply SCHEDULE."
    return [_m(f"📦 Order *{oid}*: *{cur}*\nExpected live by {v['target_eta']}.{slot}\nNothing else to do on your side.", ["SCHEDULE", "MENU"])]


def _schedule(st: dict, phone: str, text: str) -> list[dict]:
    oid = _order(phone)
    if not oid:
        return [_m("I need an order first. Reply *1* to build your bundle.")]
    sl = orders.slots(oid)[:6]
    st.update(mode="schedule", order=oid, opts=[s["id"] for s in sl])
    cur = orders.ORDERS[oid]["slot"]
    head = f"Your slot is *{cur['label']}*. Pick a new one:" if cur else "Pick an installation slot:"
    return [_m(head + "\n" + "\n".join(f"{i+1}. {s['label']}" for i, s in enumerate(sl)), [{"label": s["label"], "send": str(i + 1)} for i, s in enumerate(sl)])]


def _trouble_menu(st: dict, phone: str) -> list[dict]:
    oid = _order(phone)
    if not oid:
        return [_m("I can't find an active order for this number. Reply *1* to build a bundle first.")]
    st.update(mode="trouble", order=oid, opts=["slow", "down", "billing", "other"])
    o = orders.ORDERS[oid]
    note = "\n⚠️ We already see an outage on your link; ticket and ETA are on the way." if o["outage_active"] else ""
    return [_m("What's wrong?\n1. Internet is slow\n2. No internet\n3. Billing question\n4. Something else" + note, ["1", "2", "3", "4"])]


def _trouble(st: dict, phone: str, text: str) -> list[dict]:
    oid = st["order"]
    o = orders.ORDERS[oid]
    t = st["tmp"]
    sub = t.get("sub")
    low = text.lower().strip()
    if not sub:
        pick = st["opts"][int(low) - 1] if low.isdigit() and 1 <= int(low) <= 4 else (
            "slow" if re.search(r"slow|speed|buffer", low) else "down" if re.search(r"down|no internet|not working|disconnect|offline|band", low) else
            "billing" if re.search(r"bill|invoice|charge|payment", low) else "other" if low else None)
        if not pick:
            return [_m("Please reply 1–4.", ["1", "2", "3", "4"])]
        t["sub"] = pick
        if pick == "slow":
            return [_m("Let's check it. Run a speed test (fast.com or the TRAI MySpeed app) and send me the number in Mbps. Reply SKIP if you can't.", ["SKIP"])]
        if pick == "down":
            if o["outage_active"]:
                inc = o["incidents"][0]
                st["mode"], st["tmp"] = "menu", {}
                return [_m(("You're still online on the backup link while we fix the main line." if inc["failover"] else f"We already know: your link is down. Ticket {inc.get('ticket')} is open and a technician is on it, fix expected within 4 hours.") + "\nI'll message you the moment it's back.", ["MENU"])]
            return [_m("Quick checks:\n1) Is the router's power light on?\n2) Unplug it for 30 seconds, plug back, wait 2 minutes.\n3) Check the cable at the wall is firm.\n\nDid that fix it?\n1. Yes, fixed\n2. No, still down", ["1", "2"])]
        if pick == "billing":
            q = o["quote"]
            return [_m(f"Your bill is *₹{q['monthly_total']:,}/month incl. GST* on one invoice for all products. Want a billing expert to review a charge?\n1. Yes, raise a billing ticket\n2. No, that's fine", ["1", "2"])]
        return [_m("Tell me what's happening in a sentence and I'll route it to the right technician.")]
    st["tmp"] = {}
    if sub == "slow":
        num = re.search(r"\d+(\.\d+)?", low)
        if low == "skip" or not num:
            st["mode"] = "menu"
            return [_m("No problem. Tips: connect closer to the router, restart it, and pause big downloads. Reply TROUBLE if it continues.", ["MENU"])]
        r = orders.check_speed(oid, float(num.group(0)))
        st["mode"] = "menu"
        if r["plan"] is None:
            return [_m("Your plan isn't a fixed-speed plan, so I can't compare. Reply TROUBLE to raise a ticket.", ["MENU"])]
        pct = round(100 * r["measured"] / r["plan"])
        if r["ok"]:
            return [_m(f"You're getting {r['measured']:g} Mbps, {pct}% of your {r['plan']} Mbps plan. That's normal (we treat below 80% as a fault). If it feels slow, restart the router and try near it.", ["MENU"])]
        return [_m(f"⚠️ {r['measured']:g} Mbps is only {pct}% of your {r['plan']} Mbps plan. I've raised ticket *{r['ticket']['id']}* with your test attached; {r['ticket']['assigned_to']} will fix it within {r['ticket']['sla_hours']} hours.", ["MENU"])]
    if sub == "down":
        st["mode"] = "menu"
        if low in ("1", "yes", "fixed"):
            return [_m("Glad it's back! Reply MENU anytime.", ["MENU"])]
        tk = orders.create_ticket(oid, "no_internet", "Customer reports no internet; restart did not help.", ["Power-cycled router", "Checked cable"])
        return [_m(f"Sorry about that. I've raised ticket *{tk['id']}* with the steps you tried, so you won't repeat yourself. {tk['assigned_to']} will fix it within {tk['sla_hours']} hours. I'll update you here.", ["STATUS", "MENU"])]
    if sub == "billing":
        st["mode"] = "menu"
        if low in ("1", "yes"):
            tk = orders.create_ticket(oid, "billing", "Customer asked for billing review.")
            return [_m(f"Done: ticket *{tk['id']}* raised. A billing expert will reply within {tk['sla_hours']} hours.", ["MENU"])]
        return [_m("Okay. Reply MENU anytime.", ["MENU"])]
    st["mode"] = "menu"
    tk = orders.create_ticket(oid, "other", text)
    return [_m(f"Thanks. I've raised ticket *{tk['id']}* and routed it to {tk['assigned_to']} (SLA {tk['sla_hours']}h).", ["MENU"])]


def _branch(st: dict, phone: str, text: str) -> list[dict]:
    oid = _order(phone)
    if not oid:
        return [_m("I need an existing order to copy from. Reply *1* to build your bundle first.")]
    t = st["tmp"]
    if t.get("preview") and text.strip().lower() in ("yes", "y", "confirm", "haan"):
        p = t["preview"]
        r = orders.branch(oid, p["name"], p["city"], p["pincode"], confirm=True)
        st.update(mode="menu", tmp={})
        return [_m(f"🏪 Branch created: order *{r['order']['id']}* for {p['name']}.\nKYC reused. Now send a photo of the new branch's *address proof* (≤ 90 days old).\nReply SCHEDULE to book the install.", ["SCHEDULE", "MENU"])]
    pin = re.search(r"\b[1-9]\d{5}\b", text)
    city = next((c for c in CITY_TIER if c.lower() in text.lower()), None)
    if not (pin and city):
        st.update(mode="branch", tmp={})
        return [_m("Where is the new branch? Send the city and 6-digit pincode, e.g. *Nashik 422001*.", ["Nashik 422001", "Pune 411016"])]
    p = orders.branch(oid, f"{city} branch", city, pin.group(0))
    t["preview"] = {"name": f"{city} branch", "city": city, "pincode": pin.group(0)}
    st["mode"] = "branch"
    lines = [f"• {PRODUCTS[i['product_id']]['product_name']} ×{i['qty']}" for i in p["items"]]
    extra = f"\n⚠️ {p['network']['message']}" + (f" Removed (needs a fixed line): {', '.join(p['removed'])}." if p["removed"] else "") if p["network"].get("fallback_applied") else "\n" + p["network"]["message"]
    return [_m(f"🏪 *Branch-in-a-Box* for {city} ({pin.group(0)}) copied from your head office:\n" + "\n".join(lines) +
               f"\n\n+₹{p['quote']['monthly_total']:,}/month incl. GST (total after: ₹{p['total_after']:,}).{extra}\n✅ KYC reused; only new address proof needed.\n\nReply *YES* to create it.", ["YES", "MENU"])]


# -------------------------------------------------------- buy & KYC on WhatsApp
def _start_kyc(st: dict, s: dict) -> list[dict]:
    st.update(mode="kyc", docs={}, tmp={})
    g = s["slots"].get("gstin")
    head = "🎉 Great choice! Let's verify you right here, no forms, no visit."
    if g:
        head += f"\nYour GSTIN ({kyc.mask(g)}) is already verified."
    return [_m(head + "\n\nSend clear photos (any order, one by one):\n• GST certificate\n• Udyam certificate (optional)\n• Signatory ID\n• Address proof (≤ 90 days)\n\nI'll tell you right away if anything needs a retake. Reply *DONE* when finished, or *SAMPLE K03* to try specimen documents.", ["SAMPLE K03", "SAMPLE K01", "SAMPLE K11"])]


def _kyc_image(st: dict, image: bytes) -> list[dict]:
    issues = kyc.quality(image)
    if issues:
        return [_m("📷 Please retake that one:\n" + "\n".join(f"• {i}" for i in issues))]
    lines = kyc.ocr_lines(image)
    kind = kyc.classify(lines)
    if kind == "unknown":
        return [_m("I couldn't tell which document that is. Make sure the whole page is in the frame and the title is visible.")]
    d = kyc.parse(kind, lines)
    st["docs"][kind] = d
    shown = {"gst": d.get("trade_name") or d.get("legal_name"), "udyam": d.get("enterprise_name"), "id": d.get("name"), "address": d.get("billed_to")}[kind]
    need = [DOC_LABEL[k] for k in ("gst", "id", "address") if k not in st["docs"]]
    msg = f"✅ Got your *{DOC_LABEL[kind]}*" + (f" ({shown})" if shown else "") + "."
    msg += ("\nStill needed: " + ", ".join(need) + ".") if need else "\nThat's everything I need. Reply *DONE* to verify."
    return [_m(msg, ["DONE"] if not need else [])]


def _kyc_verify(st: dict, s: dict, sample: str | None = None) -> list[dict]:
    if sample:
        from .main import _sample_one
        res = _sample_one(sample)
        if not res:
            return [_m("I don't have that specimen. Try SAMPLE K03.")]
    else:
        if not st["docs"]:
            return [_m("Send at least your GST certificate, ID and address proof first.")]
        res = kyc.validate(st["docs"], s["slots"].get("gstin"))
    st["tmp"]["kyc"] = res
    v = res["verdict"]
    head = {"approved": "✅ *Verified instantly.*", "review": "⚠️ *Almost there.* A few items need a look.", "rejected": "⛔ *I couldn't verify these documents.*"}[v]
    bad = [c for c in res["checks"] if c["status"] != "pass"][:4]
    body = "\n".join(f"{'❌' if c['status'] == 'fail' else '⚠️'} {c['label']}: {c['detail']}" for c in bad)
    if v == "rejected":
        return [_m(head + "\n" + body + "\n\nReply *HELP* and a partner will fix it with you on a short call, with your documents already attached.", ["HELP", "MENU"])]
    st["mode"] = "sign"
    return [_m(head + ("\n" + body if body else "") + f"\n\n{res['passed']} checks passed. Reply *SIGN* to e-sign and place the order (demo OTP: 123456).", ["SIGN"])]


def _place(st: dict, phone: str, s: dict) -> list[dict]:
    reco = s["reco"]
    items = [{"product_id": i["product_id"], "qty": i["qty"]} for i in reco["items"] if i["selected"]]
    sl = s["slots"]
    cust = {"business": sl.get("business_name") or reco["profile"]["business_type"], "phone": phone, "city": reco["profile"]["city"], "gstin": sl.get("gstin", ""),
            "spend": sl.get("spend", 0), "sites": reco["profile"]["sites"] or 1, "employees": reco["profile"]["employees"] or 3, "segment": reco["segment"], "esign": "ESIGN-WA"}
    consent = {"id": "CNWA" + phone[-4:], "notice_version": "v1.0 (DPDP Act 2023)", "retention": "Documents deleted 30 days after verification", "purposes": ["kyc", "ocr", "contact"]}
    o = orders.create_order(items, 12, cust, {"verdict": st["tmp"].get("kyc", {}).get("verdict", "approved")}, consent, {"method": "UPI AutoPay"})
    s["ordered"] = o["id"]
    st.update(mode="menu", order=o["id"], tmp={})
    return [_m(f"🎉 *Order {o['id']} placed!* ₹{o['quote']['monthly_total']:,}/month incl. GST, one bill.\nExpected live by {o['target_eta']}.\n\nPick your installation slot now: reply *SCHEDULE*. Reply *STATUS* anytime. No need to call us.", ["SCHEDULE", "STATUS"])]


# -------------------------------------------------------------- lead rescue
def nudge(phone: str) -> list[dict]:
    """Lead Rescue: find an abandoned advisor session (bundle built, no order) and reach out with the exact next step."""
    st = _st(phone)
    cand = [s for s in advisor.SESSIONS.values() if s.get("reco") and not s.get("ordered")]
    s = cand[-1] if cand else None
    if not s:
        s = advisor.new_session("en", "whatsapp", phone)
        s["slots"] = {"business_type": "Kirana store", "city": "Pune", "employees": 3, "sites": 1, "current_internet": "Mobile hotspot", "spend": 1500, "has_gstin": False}
        s["needs"] = ["payments"]
        advisor._finish(s)
    q = s["reco"]["quote"]
    st.update(mode="rescue", sid=s["id"], opts=[])
    name = (s["slots"].get("business_name") or s["reco"]["profile"]["business_type"]).strip()
    return [_m(f"Hi 👋 this is Sync from Accel Business. Your bundle for *{name}* is saved: *₹{q['monthly_total']:,}/month incl. GST* for {len(q['lines'])} services.\n\n"
               "You're only *one step* away: KYC takes about 2 minutes, right here on WhatsApp. No visit, no paperwork.\n\nReply *YES* to continue, or *LATER* and I'll remind you.", ["YES", "LATER"])]


# ----------------------------------------------------------------- router
def handle(phone: str, text: str, image: bytes | None = None) -> list[dict]:
    st = _st(phone)
    text = (text or "").strip()
    up = text.upper()
    if DEVANAGARI.search(text) and st["mode"] in (None, "menu"):
        st["lang"] = "hi"
    if st["mode"] is None or up in ("HI", "HELLO", "MENU", "START", "RESET", "NAMASTE", "नमस्ते", "हाय"):
        if up == "RESET":
            st.update(sid=None, docs={}, tmp={}, order=None)
        return _menu(st)
    mode = st["mode"]

    # global commands
    if up in ("STATUS", "TRACK"):
        return _status(st, phone)
    if up in ("SCHEDULE", "RESCHEDULE"):
        return _schedule(st, phone, text)
    if up in ("TROUBLE", "FIX"):
        return _trouble_menu(st, phone)
    if up == "BRANCH":
        st["tmp"] = {}
        return _branch(st, phone, "")
    if up in ("SHIELD", "SCAM", "CHECK"):
        st["mode"] = "shield"
        return [_m("🛡️ *SYNC Scam Shield*: forward me any suspicious message, link or payment screenshot and I'll tell you what looks wrong and what to do.", ["MENU"])]
    if up.startswith("NETWORK"):
        return _network(st, text)
    if up == "BACKUP":
        oid = _order(phone)
        if oid:
            try:
                v = orders.add_failover(oid)
                return [_m(f"✅ Backup 4G/5G Failover added. Your new total is ₹{v['quote']['monthly_total']:,}/month incl. GST.", ["STATUS"])]
            except ValueError as e:
                return [_m(str(e))]
    if up == "HELP" and mode in ("kyc", "sign"):
        from . import ops
        s = advisor.SESSIONS.get(st["sid"])
        if s:
            h = ops.create_handoff(s, "kyc_needs_partner_help")
            return [_m(f"A partner ({h['partner']}) will call you within {h['sla']}, with your chat and documents already shared.", ["MENU"])]

    # mode handling
    if mode == "menu":
        if text.isdigit() and 1 <= int(text) <= len(st["opts"]):
            pick = st["opts"][int(text) - 1]
            if pick == "buy":
                s = advisor.new_session(st["lang"], "whatsapp", phone)
                st.update(mode="advisor", sid=s["id"])
                return render_advisor(s["messages"])
            if pick == "shield":
                return handle(phone, "SHIELD")
            if pick == "network":
                return _network(st, "")
            if pick == "status":
                return _status(st, phone)
            if pick == "fix":
                return _trouble_menu(st, phone)
            if pick == "branch":
                st["tmp"] = {}
                return _branch(st, phone, "")
        if image or URL_ANY.search(text):
            return [_m("🛡️ I noticed " + ("a screenshot" if image else "a link") + ". Here's what I found:")] + _shield(st, text, image)
        return _menu(st)

    if mode == "shield":
        return _shield(st, text, image)
    if mode == "network":
        return _network(st, text)
    if mode == "schedule":
        if text.isdigit() and 1 <= int(text) <= len(st["opts"]):
            try:
                v = orders.schedule(st["order"], st["opts"][int(text) - 1])
            except ValueError as e:
                return [_m(str(e) + " Reply MENU.")]
            st["mode"] = "menu"
            return [_m(f"📅 Booked: *{v['slot']['label']}*. A technician will arrive in that window; you'll get a reminder the evening before. Need to change it? Reply RESCHEDULE.", ["STATUS", "MENU"])]
        return _schedule(st, phone, text)
    if mode == "trouble":
        return _trouble(st, phone, text)
    if mode == "branch":
        return _branch(st, phone, text)
    if mode == "rescue":
        if up in ("YES", "Y", "HAAN", "हाँ"):
            return _start_kyc(st, advisor.SESSIONS[st["sid"]])
        st["mode"] = "menu"
        return [_m("No problem, your bundle stays saved for 7 days. Reply YES to continue anytime.", ["YES", "MENU"])] if up == "LATER" else _menu(st)
    if mode == "kyc":
        s = advisor.SESSIONS.get(st["sid"])
        if image:
            return _kyc_image(st, image)
        if up.startswith("SAMPLE"):
            return _kyc_verify(st, s, (text.split() + ["K03"])[1].upper())
        if up == "DONE":
            return _kyc_verify(st, s)
        return [_m("Send a photo of your document, or reply DONE when you've sent them all.", ["DONE"])]
    if mode == "sign":
        s = advisor.SESSIONS.get(st["sid"])
        if up == "SIGN":
            return [_m("An OTP was sent to your number. Reply with the 6-digit code (demo: *123456*).", ["123456"])]
        if text == "123456":
            return _place(st, phone, s)
        return [_m("Reply SIGN, then the OTP.", ["SIGN"])]
    if mode == "advisor":
        s = advisor.SESSIONS[st["sid"]]
        if up == "BUY" and s.get("reco"):
            return _start_kyc(st, s)
        before = len(s["messages"])
        t, value = _chip_value(st, s, text)
        advisor.handle(s["id"], t, value)
        return render_advisor(s["messages"][before + 1:])
    return _menu(st)
