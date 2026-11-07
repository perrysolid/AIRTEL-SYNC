"""Smart KYC: OCR -> field extraction -> registry lookups -> cross-document validation.

Privacy by design: identifiers are masked in every response/log, raw images are processed in memory only
(unless the caller keeps them for the demo), and only the fields required for each check are extracted."""
from __future__ import annotations
import io, re, difflib
import numpy as np
from PIL import Image
from .data import gstin_reg, udyam_reg, TODAY

_ocr = None
import threading
OCR_LOCK = threading.Lock()   # one OCR call at a time: the engine is not guaranteed thread-safe


def _engine():
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    return _ocr


# ---------------- identifiers ----------------
_GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
UDYAM_RE = re.compile(r"^UDYAM-[A-Z]{2}-\d{2}-\d{7}$")


def gstin_checksum_ok(g: str) -> bool:
    if not GSTIN_RE.match(g):
        return False
    total = 0
    for i, ch in enumerate(g[:14]):
        v = _GST_CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += v // 36 + v % 36
    return _GST_CHARS[(36 - total % 36) % 36] == g[14]


_TO_LET = {"0": "O", "1": "I", "5": "S", "8": "B", "2": "Z"}
_TO_DIG = {v: k for k, v in _TO_LET.items()}


def repair_gstin(g: str) -> str:
    """Fix classic OCR confusions (0/O, 1/I, 5/S, 8/B) using the positional GSTIN grammar: DD LLLLL DDDD L ? Z ?"""
    if len(g) != 15:
        return g
    out = []
    for i, ch in enumerate(g):
        if i in (2, 3, 4, 5, 6, 11):
            out.append(_TO_LET.get(ch, ch))
        elif i in (0, 1, 7, 8, 9, 10):
            out.append(_TO_DIG.get(ch, ch))
        else:
            out.append(ch)
    return "".join(out)


def mask(v: str | None, keep: int = 4) -> str:
    if not v:
        return ""
    return "•" * max(len(v) - keep, 0) + v[-keep:]


def norm(s: str) -> str:
    s = re.sub(r"\(prop\.?[^)]*\)", "", s or "", flags=re.I)
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())


def sim(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, norm(a) or "", norm(b) or "").ratio()


# ---------------- OCR ----------------
def ocr_lines(img_bytes: bytes) -> list[str]:
    """Threshold removes the pink 'SPECIMEN' watermark so the dark text survives."""
    im = Image.open(io.BytesIO(img_bytes)).convert("L").point(lambda p: 255 if p > 110 else 0).convert("RGB")
    with OCR_LOCK:
        res, _ = _engine()(np.array(im))
    return [r[1].strip() for r in (res or [])]


def _after(lines: list[str], label: str, n: int = 1) -> str | None:
    for i, l in enumerate(lines):
        if label.lower() in l.lower():
            nxt = lines[i + 1:i + 1 + n]
            return " ".join(nxt) if nxt else None
    return None


def classify(lines: list[str]) -> str:
    t = " ".join(lines).lower()
    if "gst registration" in t or "legal name" in t:
        return "gst"
    if "udyam" in t:
        return "udyam"
    if "consumer no" in t or "supply address" in t:
        return "address"
    if "id no" in t or "valid till" in t:
        return "id"
    return "unknown"


def parse(kind: str, lines: list[str]) -> dict:
    out: dict = {"type": kind}
    text = " ".join(lines)
    if kind == "gst":
        cand = [re.sub(r"\s", "", l).upper() for l in lines]
        raw = next((c for c in cand if re.fullmatch(r"[0-9A-Z]{15}", c) and re.match(r"\d{2}", c)), None)
        out["gstin"] = raw
        if raw:
            fixed = repair_gstin(raw)
            if fixed != raw and gstin_checksum_ok(fixed):
                out["gstin"], out["autocorrected"] = fixed, True
        out["legal_name"] = _after(lines, "Legal name")
        out["trade_name"] = _after(lines, "Trade name")
        out["constitution"] = _after(lines, "Constitution")
        a1 = _after(lines, "Address of principal")
        a2 = _after(lines, "place of business")
        out["address"] = " ".join(x for x in (a1, a2) if x and not x.lower().startswith("date")) or None
        out["date"] = next(iter(re.findall(r"\d{4}-\d{2}-\d{2}", text)), None)
    elif kind == "udyam":
        out["udyam_number"] = next((m.group(0) for m in (re.search(r"UDYAM-[A-Z]{2}-\d{2}-\d{7}", re.sub(r"\s", "", l).upper()) for l in lines) if m), None)
        out["enterprise_name"] = _after(lines, "Enterprise name")
        out["activity"] = _after(lines, "Major activity")
        out["city"] = _after(lines, "City")
        out["state"] = _after(lines, "State")
        out["date"] = next(iter(re.findall(r"\d{4}-\d{2}-\d{2}", text)), None)
    elif kind == "address":
        out["billed_to"] = _after(lines, "Billed to")
        a1 = _after(lines, "Supply address")
        out["address"] = " ".join(x for x in (a1, lines[lines.index(a1) + 1] if a1 in lines and lines.index(a1) + 1 < len(lines) else "") if x)
        out["bill_date"] = next(iter(re.findall(r"\d{4}-\d{2}-\d{2}", text)), None)
    elif kind == "id":
        out["name"] = _after(lines, "Name")
        out["designation"] = _after(lines, "Designation")
        out["business"] = _after(lines, "For business")
        out["id_no"] = _after(lines, "ID no.")
        out["valid_till"] = next(iter(re.findall(r"\d{4}-\d{2}-\d{2}", _after(lines, "Valid till") or "")), None)
    return out


# ---------------- registry lookups (mock APIs) ----------------
def lookup_gstin(g: str) -> dict:
    g = (g or "").strip().upper()
    if not GSTIN_RE.match(g):
        return {"found": False, "valid_format": False, "checksum_ok": False}
    base = {"valid_format": True, "checksum_ok": gstin_checksum_ok(g)}
    if g not in gstin_reg.index:
        return {**base, "found": False}
    r = gstin_reg.loc[g]
    return {**base, "found": True, "legal_name": r.legal_name, "trade_name": r.trade_name, "constitution": r.constitution,
            "address": r.principal_place_of_business, "state": r.state, "registered": r.registration_date, "status": r.status}


def lookup_udyam(u: str) -> dict:
    u = (u or "").strip().upper()
    if not UDYAM_RE.match(u):
        return {"found": False, "valid_format": False}
    if u not in udyam_reg.index:
        return {"found": False, "valid_format": True}
    r = udyam_reg.loc[u]
    return {"found": True, "valid_format": True, "enterprise_name": r.enterprise_name, "type": r.enterprise_type,
            "activity": r.major_activity, "nic": r.nic_description, "state": r.state, "city": r.city,
            "registered": r.date_of_registration}


# ---------------- validation ----------------
def _chk(id_: str, label: str, status: str, detail: str, doc: str | None = None) -> dict:
    return {"id": id_, "label": label, "status": status, "detail": detail, "doc": doc}  # pass | warn | fail


def validate(docs: dict[str, dict], typed_gstin: str | None = None, typed_udyam: str | None = None) -> dict:
    """docs: {kind: parsed}. Returns checks + overall verdict (approved | review | rejected)."""
    checks: list[dict] = []
    gst, udy, adr, idd = docs.get("gst"), docs.get("udyam"), docs.get("address"), docs.get("id")
    gstin = typed_gstin or (gst or {}).get("gstin")
    reg = None
    # ---- GST
    if gst or gstin:
        g = (gstin or "").upper()
        if not g:
            checks.append(_chk("gst_num", "GSTIN readable", "fail", "No GSTIN could be read from the certificate.", "gst"))
        elif not GSTIN_RE.match(g):
            checks.append(_chk("gst_fmt", "GSTIN format", "fail", f"{mask(g)} is not a valid 15-character GSTIN.", "gst"))
        else:
            ok = gstin_checksum_ok(g)
            checks.append(_chk("gst_fmt", "GSTIN format & checksum", "pass" if ok else "fail",
                               "Structure and check digit are valid." if ok else f"{mask(g)} fails the GSTIN check digit; likely a typo or altered number.", "gst"))
            reg = lookup_gstin(g)
            if not reg["found"]:
                checks.append(_chk("gst_reg", "GST registry lookup", "fail", "GSTIN not found in the GST registry.", "gst"))
            else:
                st = reg["status"]
                checks.append(_chk("gst_status", "GST registration status", "pass" if st == "Active" else "fail",
                                   f"Registry status: {st}." + ("" if st == "Active" else " Products needing a GSTIN cannot be sold until it is active."), "gst"))
                if gst and gst.get("legal_name"):
                    s = sim(gst["legal_name"], reg["legal_name"])
                    checks.append(_chk("gst_name", "Certificate name matches registry", "pass" if s > .9 else "warn" if s > .7 else "fail",
                                       f"Certificate: “{gst['legal_name']}”, registry: “{reg['legal_name']}”.", "gst"))
                if gst and gst.get("address"):
                    s = sim(gst["address"], reg["address"])
                    if s < .85:
                        checks.append(_chk("gst_addr", "Certificate address matches registry", "warn" if s > .6 else "fail",
                                           f"Address on the certificate differs from the registry ({int(s*100)}% match).", "gst"))
    # ---- Udyam
    if udy:
        u = typed_udyam or udy.get("udyam_number")
        if not u:
            checks.append(_chk("udy_num", "Udyam number readable", "fail", "The Udyam registration number is missing or unreadable on the certificate.", "udyam"))
        else:
            ur = lookup_udyam(u)
            if not ur["valid_format"]:
                checks.append(_chk("udy_fmt", "Udyam number format", "fail", f"{mask(u)} is not a valid Udyam number.", "udyam"))
            elif not ur["found"]:
                checks.append(_chk("udy_reg", "Udyam registry lookup", "fail", "Udyam number not found in the registry.", "udyam"))
            else:
                checks.append(_chk("udy_reg", "Udyam registry lookup", "pass", f"Registered as {ur['type']} enterprise ({ur['activity']}).", "udyam"))
                if udy.get("enterprise_name"):
                    s = sim(udy["enterprise_name"], ur["enterprise_name"])
                    checks.append(_chk("udy_name", "Udyam name matches registry", "pass" if s > .9 else "warn" if s > .7 else "fail",
                                       f"Certificate: “{udy['enterprise_name']}”, registry: “{ur['enterprise_name']}”.", "udyam"))
    # ---- cross-document
    names = {k: v for k, v in {
        "GST (trade)": (gst or {}).get("trade_name"), "Udyam": (udy or {}).get("enterprise_name"),
        "Utility bill": (adr or {}).get("billed_to"), "Signatory ID (business)": (idd or {}).get("business")}.items() if v}
    if len(names) >= 2:
        base_k, base_v = next(iter(names.items()))
        bad = [(k, v) for k, v in names.items() if sim(base_v, v) < .8]
        checks.append(_chk("x_names", "Business name consistent across documents", "pass" if not bad else "fail",
                           "All documents carry the same business name." if not bad else
                           "Name mismatch: " + "; ".join(f"{k} says “{v}”" for k, v in [(base_k, base_v)] + bad), "cross"))
    if gst and adr and gst.get("address") and adr.get("address"):
        s = sim(gst["address"], adr["address"])
        checks.append(_chk("x_addr", "Address on GST matches utility bill", "pass" if s > .85 else "warn" if s > .6 else "fail",
                           "Addresses match." if s > .85 else f"Addresses differ ({int(s*100)}% match): GST “{gst['address']}” vs bill “{adr['address']}”.", "cross"))
    if udy and gst and udy.get("city") and gst.get("address"):
        if udy["city"].lower() not in gst["address"].lower():
            checks.append(_chk("x_city", "Udyam city matches GST address", "warn", f"Udyam city is {udy['city']} but the GST address is elsewhere.", "cross"))
    if gst and idd and gst.get("legal_name") and idd.get("name"):
        ln = gst["legal_name"]
        ok = norm(idd["name"]) in norm(ln) or sim(idd["name"], ln) > .8 or "llp" in ln.lower() or "pvt" in ln.lower() or "ltd" in ln.lower()
        checks.append(_chk("x_sig", "Signatory is linked to the business", "pass" if ok else "warn",
                           f"{idd['name']} ({idd.get('designation','')}) is the proprietor/authorised person." if ok else
                           f"{idd['name']} is not the proprietor named on the GST certificate; an authorisation letter may be needed.", "cross"))
    # ---- address proof age (<= 90 days from 2026-07-15)
    if adr:
        d = adr.get("bill_date")
        if not d:
            checks.append(_chk("adr_date", "Utility bill date", "fail", "Bill date could not be read.", "address"))
        else:
            age = (TODAY - __import__("pandas").Timestamp(d)).days
            checks.append(_chk("adr_age", "Address proof is recent (≤ 90 days)", "pass" if 0 <= age <= 90 else "fail",
                               f"Bill dated {d} is {age} days old." if age >= 0 else f"Bill is dated in the future ({d}).", "address"))
    # ---- ID validity
    if idd:
        v = idd.get("valid_till")
        if not v:
            checks.append(_chk("id_valid", "ID validity", "warn", "Could not read the ID expiry date.", "id"))
        else:
            left = (__import__("pandas").Timestamp(v) - TODAY).days
            checks.append(_chk("id_valid", "Signatory ID is valid", "pass" if left > 0 else "fail",
                               f"Valid until {v}." if left > 0 else f"ID expired on {v}.", "id"))
    if not checks:
        checks.append(_chk("none", "Documents", "fail", "No readable documents were provided."))
    fails = [c for c in checks if c["status"] == "fail"]
    warns = [c for c in checks if c["status"] == "warn"]
    verdict = "rejected" if any(c["id"] in ("gst_status", "gst_fmt", "gst_reg") and c["status"] == "fail" for c in checks) else \
        "review" if fails or warns else "approved"
    if fails and verdict != "rejected":
        verdict = "review"
    return {"checks": checks, "verdict": verdict, "failed": len(fails), "warnings": len(warns), "passed": len(checks) - len(fails) - len(warns),
            "gst_active": (reg or {}).get("status") == "Active" if reg and reg.get("found") else None,
            "extracted": {k: _masked(v) for k, v in docs.items()}}


def _masked(d: dict) -> dict:
    d = dict(d)
    for k in ("gstin", "udyam_number", "id_no"):
        if d.get(k):
            d[k] = mask(d[k], 4 if k != "udyam_number" else 7)
    return d


def process_images(files: list[tuple[str, bytes]], typed_gstin: str | None = None, typed_udyam: str | None = None) -> dict:
    docs = {}
    for name, b in files:
        lines = ocr_lines(b)
        kind = classify(lines)
        if kind == "unknown":
            continue
        docs[kind] = parse(kind, lines)
    res = validate(docs, typed_gstin, typed_udyam)
    res["files"] = [n for n, _ in files]
    return res


def quality(img_bytes: bytes) -> list[str]:
    """Cheap photo-quality triage so the owner gets a *specific* retake reason instead of 'verification failed'."""
    issues = []
    try:
        im = Image.open(io.BytesIO(img_bytes)).convert("L")
    except Exception:
        return ["I couldn't open that file. Please send a photo (JPG/PNG)."]
    w, h = im.size
    if w < 500 or h < 500:
        issues.append(f"The photo is too small ({w}x{h}). Move closer or send the original, not a thumbnail.")
    a = np.asarray(im.resize((min(w, 900), int(h * min(w, 900) / w))), dtype=float)
    lap = a[1:-1, 1:-1] * 4 - a[:-2, 1:-1] - a[2:, 1:-1] - a[1:-1, :-2] - a[1:-1, 2:]
    if lap.var() < 25:
        issues.append("The photo looks blurry. Hold the phone steady and tap to focus on the text.")
    if a.std() < 12:
        issues.append("There is almost no contrast: the photo may be too dark, too bright or blank. Use good, even light.")
    return issues
