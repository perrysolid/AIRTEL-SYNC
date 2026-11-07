"""Eligibility rules + transparent pricing built on product_catalogue.csv."""
from __future__ import annotations
from dataclasses import dataclass, field
from .data import PRODUCTS

GST_RATE = 0.18
CATEGORY_ORDER = ["Connectivity", "Communication", "Cloud & Productivity", "Security", "IoT & Physical"]


@dataclass
class Profile:
    business_name: str = ""
    business_type: str = ""
    segment: str = ""          # micro | prof | multi | mfg
    city: str = ""
    city_tier: int = 2
    employees: int = 0
    sites: int = 1
    has_gstin: bool | None = None
    gstin_active: bool | None = None   # set after registry lookup
    current_internet: str = ""
    monthly_spend: int = 0
    needs: list[str] = field(default_factory=list)
    language: str = "en"
    force_conn: str = ""       # e.g. "P04" when the Network Reality Check says fibre is not available


def eligibility(pid: str, p: Profile, bundle: set[str] | None = None) -> dict:
    """Return {ok, blockers[], unlock} for a product against a profile (+ dependencies in bundle)."""
    pr = PRODUCTS[pid]
    blockers: list[dict] = []
    tiers = {int(t) for t in str(pr["available_city_tiers"]).split(";") if t}
    if p.city_tier not in tiers:
        blockers.append({"code": "city_tier", "msg": f"Not yet available in Tier-{p.city_tier} cities"})
    if p.employees and p.employees < int(pr["min_employees"]):
        blockers.append({"code": "min_employees", "msg": f"Offered to teams of {pr['min_employees']}+ people"})
    if p.sites < int(pr["min_sites"]):
        blockers.append({"code": "min_sites", "msg": f"Offered to businesses with {pr['min_sites']}+ sites"})
    if pr["requires_gstin"] == "Y" and not (p.has_gstin and p.gstin_active is not False):
        blockers.append({"code": "gstin", "msg": "Needs an active GSTIN", "unlock": "gstin"})
    deps = [d for d in str(pr["requires_one_of"]).split("|") if d]
    if deps and bundle is not None and not (set(deps) & bundle):
        blockers.append({"code": "dependency", "needs_one_of": deps,
                             "msg": "Needs a connectivity plan in the same bundle" if "P04" in deps else "Needs a fixed-line plan (fibre or leased line); not available with 5G AirFiber"})
    return {"ok": not blockers, "blockers": blockers}


def price_point(pid: str, contract_months: int) -> tuple[int, int]:
    """Transparent price rule: the longer you commit, the closer to the floor of the catalogue range.
    24m -> floor, 12m -> midpoint, shorter -> ceiling.  Returns (monthly_unit_price, effective_contract)."""
    pr = PRODUCTS[pid]
    lo, hi = float(pr["price_min_inr_per_month"]), float(pr["price_max_inr_per_month"])
    min_c = int(pr["min_contract_months"])
    eff = max(min_c, contract_months)
    f = 0.0 if eff >= 24 else 0.5 if eff >= 12 else 1.0
    return round(lo + (hi - lo) * f), eff


def bundle_discount_pct(n_products: int, n_categories: int) -> int:
    if n_products >= 5 and n_categories >= 3:
        return 8
    if n_products >= 3 and n_categories >= 2:
        return 5
    return 0


def build_quote(items: list[dict], contract_months: int = 12, current_spend: int = 0) -> dict:
    """items: [{product_id, qty}] -> full transparent quote."""
    lines, monthly, setup = [], 0, 0
    cats = set()
    for it in items:
        pid, qty = it["product_id"], max(1, int(it.get("qty", 1)))
        pr = PRODUCTS[pid]
        unit, eff = price_point(pid, contract_months)
        line_m, line_s = unit * qty, int(pr["one_time_setup_inr"]) * qty
        monthly += line_m
        setup += line_s
        cats.add(pr["category"])
        lines.append({
            "product_id": pid, "name": pr["product_name"], "category": pr["category"], "unit": pr["unit"],
            "qty": qty, "unit_price": unit, "monthly": line_m, "setup": line_s, "contract_months": eff,
            "list_price": int(float(pr["price_max_inr_per_month"])), "install_days": int(pr["typical_install_days"]),
            "description": pr["description"],
        })
    disc_pct = bundle_discount_pct(len(lines), len(cats))
    discount = round(monthly * disc_pct / 100)
    net = monthly - discount
    gst = round(net * GST_RATE)
    setup_gst = round(setup * GST_RATE)
    longest = max([l["contract_months"] for l in lines] or [0])
    return {
        "lines": lines, "subtotal_monthly": monthly, "bundle_discount_pct": disc_pct, "bundle_discount": discount,
        "monthly_ex_gst": net, "gst_monthly": gst, "monthly_total": net + gst,
        "setup_ex_gst": setup, "setup_gst": setup_gst, "setup_total": setup + setup_gst,
        "contract_months": longest, "install_days": max([l["install_days"] for l in lines] or [0]),
        "first_invoice": net + gst + setup + setup_gst,
        "current_spend": current_spend,
        "vs_current": (net + gst) - current_spend if current_spend else None,
        "one_bill": True,
    }
