"""Network Reality Check: tells the owner what can actually be installed at their address BEFORE they pay.

DEMO NOTE: no real coverage API exists in the data pack, so availability is a deterministic simulation keyed on the
pincode (same pincode -> same answer) with tier-based odds. It is clearly labelled 'simulated' in every response."""
from __future__ import annotations
import hashlib, re
from .data import CITY_TIER, PRODUCTS

FIBRE = ("P01", "P02", "P03")
FIXED = ("P01", "P02", "P03", "P05", "P06")
# products whose catalogue rule needs a fixed-line plan (so they cannot ride on 5G AirFiber alone)
NEEDS_FIXED = ("P09", "P10", "P11", "P21")


def _h(pin: str) -> int:
    return int(hashlib.sha256(("sync" + pin).encode()).hexdigest()[:10], 16)


def check(pincode: str, city: str | None = None) -> dict:
    pin = re.sub(r"\D", "", pincode or "")
    if len(pin) != 6 or pin[0] == "0":
        return {"ok": False, "error": "Enter a valid 6-digit pincode."}
    tier = CITY_TIER.get(city or "", 2)
    h = _h(pin)
    fibre = (h % 100) / 100 < (0.88 if tier == 1 else 0.66)
    fwa = ((h >> 8) % 100) / 100 < (0.97 if tier == 1 else 0.9)
    quality = 62 + (h >> 16) % 38          # 5G signal quality 62..99
    mbps = 55 + ((h >> 24) % 70)           # typical AirFiber speed 55..124
    options = []
    options.append({"key": "fibre", "name": "Fibre broadband", "products": ["P01", "P02"], "available": fibre,
                    "install_days": 5, "speed": "100–300 Mbps", "note": "Best for steady, heavy use." if fibre else "Fibre has not reached this lane yet."})
    options.append({"key": "airfiber", "name": "5G AirFiber (wireless)", "products": ["P04"], "available": fwa,
                    "install_days": 2, "speed": f"~{mbps} Mbps typical", "signal": quality,
                    "note": "Plug-and-play. Works where fibre does not." if fwa else "5G signal is weak here."})
    options.append({"key": "leased", "name": "Dedicated leased line", "products": ["P05", "P06"], "available": fibre,
                    "install_days": 21, "speed": "20–100 Mbps dedicated", "note": "Needs a site survey; our field engineer joins a video call."})
    rec = "fibre" if fibre else "airfiber" if fwa else "survey"
    msg = {"fibre": "Good news: fibre is available at your address. Installation takes about 5 days.",
           "airfiber": "Fibre has not reached your address, so we've switched you to 5G AirFiber. It is live in about 2 days, with no digging or wiring.",
           "survey": "We can't promise a connection from a distance here. A partner will do a free site survey before you pay anything."}[rec]
    return {"ok": True, "pincode": pin, "city": city, "tier": tier, "simulated": True, "options": options, "recommended": rec,
            "message": msg, "backup_possible": fibre, "fallback_applied": rec == "airfiber"}


def adapt_for_airfiber(items: list[dict]) -> tuple[list[dict], list[str]]:
    """Swap fibre -> 5G AirFiber and drop products whose catalogue rules need a fixed line. Returns (items, removed names)."""
    out, removed, had_fibre = [], [], False
    for it in items:
        pid = it["product_id"]
        if pid in FIXED:
            if not had_fibre:
                out.append({**it, "product_id": "P04"})
                had_fibre = True
        elif pid in NEEDS_FIXED:
            removed.append(PRODUCTS[pid]["product_name"])
        else:
            out.append(it)
    if not had_fibre and not any(i["product_id"] == "P04" for i in out):
        return items, []
    return out, removed
