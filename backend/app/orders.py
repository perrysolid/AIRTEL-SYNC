"""Orders + self-serve tracker, installation scheduler, continuity (outage) simulator, tickets and Branch-in-a-Box.
Dates are simulated from the catalogue's typical_install_days; 'today' is 2026-07-15 per the data README."""
from __future__ import annotations
import uuid, json
from datetime import timedelta
from pathlib import Path
from .catalogue import build_quote, price_point
from .data import TODAY, PRODUCTS
from .kyc import mask
from . import network

ORDERS: dict[str, dict] = {}
STORE = Path(__file__).resolve().parent.parent / "data" / "runtime_orders.json"
WINDOWS = ["9 am – 12 pm", "12 pm – 3 pm", "3 pm – 6 pm"]
SALES_PER_HOUR = {"micro": 500, "prof": 1500, "multi": 8000, "mfg": 12000}   # editable assumption, shown as such in the UI
FIXED = ("P01", "P02", "P03", "P05", "P06")
PLAN_MBPS = {"P01": 100, "P02": 300, "P03": 1000, "P04": 100, "P05": 20, "P06": 100}


def _load():
    try:
        if STORE.exists():
            ORDERS.update(json.loads(STORE.read_text(encoding="utf-8")))
    except Exception:
        pass


def _persist():
    try:
        STORE.write_text(json.dumps(ORDERS, default=str), encoding="utf-8")
    except Exception:
        pass


_load()


def _stages(inst: int, kyc_ok: bool, reused: bool = False):
    return [
        ("confirmed", "Order confirmed", "Your bundle, price and e-signed agreement are locked in.", 0),
        ("kyc", "KYC verified", "Reused from your head-office verification; only the new address proof is checked." if reused else "Documents checked against GST/Udyam registries.", 0 if kyc_ok else 1),
        ("survey", "Site check & slot booked", "We confirm feasibility and book an installation slot on WhatsApp.", 1),
        ("dispatch", "Equipment dispatched", "Router, SIMs and devices are on the way.", max(2, inst - 2)),
        ("install", "Installation", "Technician visit; for SIM/cloud products this step is instant.", inst),
        ("live", "Live & first bill", "Everything is active on one bill. You'll get a welcome message.", inst + 1),
    ]


def _build(oid: str, quote: dict, customer: dict, kyc: dict | None, consent: dict, payment: dict, parent: str | None = None, reused: bool = False) -> dict:
    inst = quote["install_days"] or 3
    kyc_ok = (kyc or {}).get("verdict") == "approved"
    stages = _stages(inst, kyc_ok, reused)
    return {
        "id": oid, "created": str(TODAY.date()), "sim_day": 0, "customer": {**customer, "gstin_masked": mask(customer.get("gstin", ""))},
        "quote": quote, "kyc_verdict": (kyc or {}).get("verdict", "pending"), "parent": parent, "branches": [], "kyc_reused": reused,
        "stages": [{"key": k, "title": t, "detail": d, "day": day, "eta": str((TODAY + timedelta(days=day)).date())} for k, t, d, day in stages],
        "lines": [{"product_id": l["product_id"], "name": l["name"], "qty": l["qty"], "install_days": l["install_days"],
                   "eta": str((TODAY + timedelta(days=l["install_days"] + 1)).date())} for l in quote["lines"]],
        "consent": consent, "payment": {"method": payment.get("method", "UPI AutoPay"), "mandate": "e-NACH registered (demo)"},
        "slot": None, "reschedules": 0, "incidents": [], "tickets": [], "outage_active": False,
        "messages": [{"day": 0, "channel": "WhatsApp", "text": f"Welcome to Accel Business! Your order {oid} is confirmed. Track it anytime: just reply STATUS."}],
    }


def create_order(items: list[dict], contract: int, customer: dict, kyc: dict | None, consent: dict, payment: dict) -> dict:
    quote = build_quote(items, contract, customer.get("spend", 0))
    oid = "ACC-" + uuid.uuid4().hex[:6].upper()
    ORDERS[oid] = _build(oid, quote, customer, kyc, consent, payment)
    _persist()
    return view(oid)


def view(oid: str) -> dict:
    o = ORDERS[oid]
    day = o["sim_day"]
    stages, current = [], None
    for st in o["stages"]:
        stages.append({**st, "state": "done" if day >= st["day"] else "todo"})
    for s in stages:
        if s["state"] == "todo":
            s["state"] = "current"
            current = s
            break
    live = all(s["state"] == "done" for s in stages)
    return {**o, "stages": stages, "current": current, "live": live,
            "days_left": max(0, o["stages"][-1]["day"] - day), "target_eta": o["stages"][-1]["eta"],
            "has_failover": any(l["product_id"] == "P09" for l in o["lines"]),
            "benchmark": {"today_avg_days": 17.6, "this_order_days": o["stages"][-1]["day"], "status_calls_avg": 3}}


def _msg(o: dict, text: str, key: str | None = None):
    o["messages"].append({"day": o["sim_day"], "channel": "WhatsApp", "text": text, **({"key": key} if key else {})})


def advance(oid: str, days: int = 1) -> dict:
    o = ORDERS[oid]
    o["sim_day"] = min(o["sim_day"] + days, o["stages"][-1]["day"])
    for st in o["stages"]:
        if st["day"] <= o["sim_day"] and not any(m.get("key") == st["key"] for m in o["messages"]) and st["key"] != "confirmed":
            _msg(o, f"{st['title']}: {st['detail']}", st["key"])
    _persist()
    return view(oid)


# ---------------- Installation scheduler ----------------
def slots(oid: str) -> list[dict]:
    o = ORDERS[oid]
    inst = o["stages"][4]["day"]
    first = max(1, inst - 1)
    out = []
    for d in range(first, first + 5):
        date = TODAY + timedelta(days=d)
        if date.weekday() == 6:          # no Sunday installs
            continue
        for w in WINDOWS:
            out.append({"id": f"{date.date()}|{w}", "date": str(date.date()), "day": d, "window": w, "label": f"{date.strftime('%a %d %b')} · {w}"})
    return out[:12]


def schedule(oid: str, slot_id: str) -> dict:
    o = ORDERS[oid]
    s = next((x for x in slots(oid) if x["id"] == slot_id), None)
    if not s:
        raise ValueError("That slot is no longer available.")
    if o["slot"] and o["reschedules"] >= 2:
        raise ValueError("You've used both free reschedules. A partner will call to help.")
    if o["slot"]:
        o["reschedules"] += 1
    o["slot"] = {"id": s["id"], "label": s["label"], "date": s["date"], "window": s["window"]}
    inst = o["stages"][4]
    inst.update(day=s["day"], eta=s["date"], detail=f"Technician visit booked for {s['label']}.")
    live = o["stages"][5]
    live.update(day=s["day"] + 1, eta=str((TODAY + timedelta(days=s["day"] + 1)).date()))
    o["stages"][3]["day"] = max(1, s["day"] - 2)
    o["stages"][3]["eta"] = str((TODAY + timedelta(days=o["stages"][3]["day"])).date())
    _msg(o, f"Installation booked: {s['label']}. Need to change it? Reply RESCHEDULE.")
    _persist()
    return view(oid)


# ---------------- Tickets & smart escalation ----------------
def _partner_for(city: str) -> str:
    from .ops import PARTNERS
    return (PARTNERS.get(city) or PARTNERS["default"])[0]


def create_ticket(oid: str, kind: str, detail: str, steps: list[str] | None = None) -> dict:
    o = ORDERS[oid]
    city = o["customer"].get("city", "")
    sla_h = 4 if kind in ("outage", "no_internet") else 24
    t = {"id": "TKT-" + uuid.uuid4().hex[:5].upper(), "kind": kind, "detail": detail, "steps_tried": steps or [], "day": o["sim_day"],
         "status": "Open", "sla_hours": sla_h, "assigned_to": _partner_for(city), "context": {"order": oid, "products": [l["name"] for l in o["lines"]], "city": city}}
    o["tickets"].insert(0, t)
    _msg(o, f"Ticket {t['id']} raised ({kind.replace('_', ' ')}). {t['assigned_to']} will fix it within {sla_h} hours; we'll update you here.")
    _persist()
    return t


def check_speed(oid: str, measured: float) -> dict:
    o = ORDERS[oid]
    plan = next((PLAN_MBPS[l["product_id"]] for l in o["lines"] if l["product_id"] in PLAN_MBPS), None)
    if not plan:
        return {"plan": None, "ok": True, "ticket": None}
    ok = measured >= 0.8 * plan
    t = None if ok else create_ticket(oid, "slow_speed", f"Measured {measured:g} Mbps vs {plan} Mbps plan (<80%).", ["Speed test shared on WhatsApp"])
    return {"plan": plan, "measured": measured, "ok": ok, "ticket": t}


# ---------------- Continuity (outage cost, failover, outage simulator) ----------------
def continuity(oid: str, sales_per_hour: float | None = None, dependent_pct: float = 60, outage_hours_month: float = 4) -> dict:
    o = ORDERS[oid]
    seg = o["customer"].get("segment", "micro")
    sph = sales_per_hour or SALES_PER_HOUR.get(seg, 500)
    has = any(l["product_id"] == "P09" for l in o["lines"])
    sites = max(1, o["customer"].get("sites", 1))
    price, _ = price_point("P09", 12)
    monthly_fail = price * sites
    at_risk_per_hour = sph * dependent_pct / 100
    loss = at_risk_per_hour * outage_hours_month
    be_hours = monthly_fail / at_risk_per_hour if at_risk_per_hour else None
    fixed = any(l["product_id"] in FIXED for l in o["lines"])
    return {"has_failover": has, "can_add_failover": fixed and not has, "sales_per_hour": sph, "dependent_pct": dependent_pct,
            "outage_hours_month": outage_hours_month, "est_loss_month": round(loss), "failover_monthly": monthly_fail,
            "failover_monthly_with_gst": round(monthly_fail * 1.18), "breakeven_hours_month": round(be_hours, 1) if be_hours else None,
            "worth_it": loss > monthly_fail, "assumptions": "Estimates use your inputs; real outage hours vary by area and provider.",
            "outage_active": o["outage_active"], "incidents": o["incidents"]}


def outage(oid: str, action: str) -> dict:
    o = ORDERS[oid]
    has = any(l["product_id"] == "P09" for l in o["lines"])
    if action == "start" and not o["outage_active"]:
        o["outage_active"] = True
        inc = {"id": "INC-" + uuid.uuid4().hex[:4].upper(), "start_day": o["sim_day"], "failover": has, "minutes": 0, "status": "Active", "ticket": None,
               "switch_seconds": 8 if has else None}
        if has:
            _msg(o, "Main internet link dropped. Backup 4G/5G took over in 8 seconds. Billing and payments are still working. We're fixing the main link.")
        else:
            t = create_ticket(oid, "outage", "Main link down; no backup attached.", ["Auto-detected by SYNC Health"])
            inc["ticket"] = t["id"]
            tip = ("Tip: a Backup 4G/5G add-on would have kept you online. Reply BACKUP to add it." if any(l["product_id"] in FIXED for l in o["lines"])
                   else "Tip: ask your partner about adding a fixed line plus backup for continuity.")
            _msg(o, f"Your internet is down. Ticket {t['id']} raised automatically, fix expected within 4 hours. {tip}")
        o["incidents"].insert(0, inc)
    elif action == "end" and o["outage_active"]:
        o["outage_active"] = False
        inc = o["incidents"][0]
        inc.update(status="Resolved", minutes=47)
        for t in o["tickets"]:
            if t["id"] == inc.get("ticket"):
                t["status"] = "Resolved"
        _msg(o, "Main link restored after 47 minutes." + (" You stayed online throughout." if inc["failover"] else " You were offline for 47 minutes; a Backup add-on prevents this."))
    _persist()
    return continuity(oid)


def add_failover(oid: str) -> dict:
    o = ORDERS[oid]
    if any(l["product_id"] == "P09" for l in o["lines"]):
        return view(oid)
    if not any(l["product_id"] in FIXED for l in o["lines"]):
        raise ValueError("Backup failover needs a fixed-line plan (fibre or leased line).")
    sites = max(1, o["customer"].get("sites", 1))
    items = [{"product_id": l["product_id"], "qty": l["qty"]} for l in o["lines"]] + [{"product_id": "P09", "qty": sites}]
    o["quote"] = build_quote(items, o["quote"]["contract_months"] or 12, o["customer"].get("spend", 0))
    q = next(l for l in o["quote"]["lines"] if l["product_id"] == "P09")
    o["lines"].append({"product_id": "P09", "name": q["name"], "qty": q["qty"], "install_days": q["install_days"], "eta": str((TODAY + timedelta(days=q["install_days"] + 1)).date())})
    _msg(o, f"Backup 4G/5G Failover added to your bundle (+₹{round(q['monthly'] * 1.18):,}/month incl. GST). Router arrives in {q['install_days']} days.")
    _persist()
    return view(oid)


# ---------------- Branch-in-a-Box ----------------
def branch(oid: str, name: str, city: str, pincode: str, staff: int | None = None, confirm: bool = False) -> dict:
    parent = ORDERS[oid]
    cust = parent["customer"]
    sites = max(1, cust.get("sites", 1))
    emp = max(1, cust.get("employees", 3))
    items = []
    for l in parent["lines"]:
        unit = PRODUCTS[l["product_id"]]["unit"]
        if unit in ("per account", "per pack", "per number", "per IP"):
            continue    # account-level products are shared across branches, not duplicated
        if unit == "per site":
            qty = 1
        elif staff:
            qty = max(1, round(l["qty"] * staff / emp))
        else:
            qty = max(1, round(l["qty"] / sites))
        items.append({"product_id": l["product_id"], "qty": qty})
    net = network.check(pincode, city)
    removed: list[str] = []
    if net.get("ok") and net["recommended"] == "airfiber":
        items, removed = network.adapt_for_airfiber(items)
    contract = parent["quote"]["contract_months"] or 12
    quote = build_quote(items, contract, 0)
    new_sites = sites + 1
    prev = {"monthly_total": parent["quote"]["monthly_total"]}
    preview = {"name": name, "city": city, "pincode": pincode, "items": items, "quote": quote, "network": net, "removed": removed,
               "kyc_reused": True, "needs": ["Address proof of the new branch (≤ 90 days)"], "new_sites": new_sites,
               "total_after": prev["monthly_total"] + quote["monthly_total"], "copied_from": parent["id"]}
    if not confirm:
        return preview
    oid2 = "ACC-" + uuid.uuid4().hex[:6].upper()
    c2 = {**cust, "business": f"{cust.get('business', 'Business')} – {name}", "city": city, "sites": 1, "pincode": pincode}
    o2 = _build(oid2, quote, c2, {"verdict": "approved"}, parent["consent"], {"method": parent["payment"]["method"]}, parent=oid, reused=True)
    ORDERS[oid2] = o2
    parent["branches"].append({"id": oid2, "name": name, "city": city})
    parent["customer"]["sites"] = new_sites
    _msg(o2, f"Branch '{name}' set up from your head-office configuration. KYC reused; just upload the new address proof.")
    _msg(parent, f"New branch '{name}' ({city}) created as order {oid2}. Added ₹{quote['monthly_total']:,}/month incl. GST.")
    _persist()
    return {**preview, "order": view(oid2)}
