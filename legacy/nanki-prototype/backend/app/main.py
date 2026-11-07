"""Accel SYNC API. Run: uvicorn app.main:app --reload --port 8000"""
from __future__ import annotations
import glob, os, threading, datetime as dt
from pathlib import Path
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import advisor, kyc, network, ops, orders, scam, wa
from .catalogue import Profile, build_quote, eligibility
from .data import PRODUCTS, DATA, CITY_TIER, catalogue
from .i18n import LANGS
from .recommend import recommend, NEED_LABELS

app = FastAPI(title="Accel SYNC", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

CONSENTS: list[dict] = []


def _clean_items(items: list[dict]) -> list[dict]:
    """Reject unknown products / bad quantities with a clear 422 instead of a 500."""
    if not items:
        raise HTTPException(422, "Add at least one product.")
    out = []
    for it in items:
        pid = str(it.get("product_id", ""))
        if pid not in PRODUCTS:
            raise HTTPException(422, f"Unknown product '{pid}'.")
        try:
            qty = int(it.get("qty", 1))
        except (TypeError, ValueError):
            raise HTTPException(422, f"Quantity for {pid} must be a whole number.")
        if not 1 <= qty <= 999:
            raise HTTPException(422, f"Quantity for {pid} must be between 1 and 999.")
        out.append({"product_id": pid, "qty": qty})
    return out
_SAMPLE_CACHE: dict[str, dict] = {}


@app.on_event("startup")
def _warm():
    def work():
        try:
            ops.train()
            _sample_results()   # pre-run OCR so the KYC demo is instant
        except Exception as e:  # never block the API
            print("warm-up failed:", e)
    threading.Thread(target=work, daemon=True).start()


@app.get("/api/health")
def health():
    return {"ok": True, "llm": bool(os.getenv("ANTHROPIC_API_KEY")), "languages": LANGS, "samples_ready": len(_SAMPLE_CACHE)}


@app.get("/api/catalogue")
def get_catalogue():
    return {"products": catalogue.to_dict("records"), "needs": NEED_LABELS, "cities": sorted(CITY_TIER)}


# ---------------- advisor ----------------
class StartReq(BaseModel):
    lang: str = "en"
    channel: str = "web"


class MsgReq(BaseModel):
    session_id: str
    text: str = ""
    value: str | None = None


@app.post("/api/advisor/start")
def adv_start(r: StartReq):
    return advisor.public(advisor.new_session(r.lang, r.channel))


@app.post("/api/advisor/message")
def adv_msg(r: MsgReq):
    if r.session_id not in advisor.SESSIONS:
        raise HTTPException(404, "session not found")
    return advisor.public(advisor.handle(r.session_id, r.text, r.value))


@app.post("/api/advisor/handoff/{sid}")
def adv_handoff(sid: str):
    if sid not in advisor.SESSIONS:
        raise HTTPException(404)
    return advisor.public(advisor.handoff(advisor.SESSIONS[sid], "customer_requested_partner"))


class ProfileReq(BaseModel):
    business_type: str = "Kirana store"
    city: str = "Pune"
    employees: int = 3
    sites: int = 1
    has_gstin: bool = False
    current_internet: str = "Mobile hotspot"
    spend: int = 0
    needs: list[str] = []
    force_conn: str = ""


@app.post("/api/recommend")
def reco(r: ProfileReq):
    p = Profile(business_type=r.business_type, city=r.city, city_tier=CITY_TIER.get(r.city, 2), employees=r.employees, sites=r.sites,
                has_gstin=r.has_gstin, current_internet=r.current_internet, monthly_spend=r.spend, needs=r.needs, force_conn=r.force_conn)
    return recommend(p)


# ---------------- quote ----------------
class QuoteReq(BaseModel):
    items: list[dict]
    contract: int = 12
    spend: int = 0
    city_tier: int = 2
    employees: int = 3
    sites: int = 1
    has_gstin: bool = False
    gstin_active: bool | None = None


@app.post("/api/quote")
def quote(r: QuoteReq):
    r.items = _clean_items(r.items)
    p = Profile(city_tier=r.city_tier, employees=r.employees, sites=r.sites, has_gstin=r.has_gstin, gstin_active=r.gstin_active)
    ids = {i["product_id"] for i in r.items}
    problems = []
    for pid in ids:
        el = eligibility(pid, p, ids)
        if not el["ok"]:
            problems.append({"product_id": pid, "blockers": el["blockers"]})
    if problems:
        raise HTTPException(422, {"error": "ineligible", "problems": problems})
    return build_quote(r.items, r.contract, r.spend)


@app.post("/api/check-bundle")
def check_bundle(r: QuoteReq):
    """Soft check used by the UI when toggling add-ons: returns blockers instead of erroring."""
    r.items = _clean_items(r.items) if r.items else []
    p = Profile(city_tier=r.city_tier, employees=r.employees, sites=r.sites, has_gstin=r.has_gstin, gstin_active=r.gstin_active)
    ids = {i["product_id"] for i in r.items}
    return {"problems": [{"product_id": pid, **eligibility(pid, p, ids)} for pid in ids if not eligibility(pid, p, ids)["ok"]],
            "quote": build_quote(r.items, r.contract, r.spend) if r.items else None}


# ---------------- lookups (mock government APIs) ----------------
class IdReq(BaseModel):
    id: str


@app.post("/api/lookup/gstin")
def lk_gstin(r: IdReq):
    res = kyc.lookup_gstin(r.id)
    if res.get("found"):
        res["gstin_masked"] = kyc.mask(r.id.upper())
    return res


@app.post("/api/lookup/udyam")
def lk_udyam(r: IdReq):
    return kyc.lookup_udyam(r.id)


# ---------------- KYC ----------------
_SAMPLE_IDS = sorted({Path(f).name[:3] for f in glob.glob(str(DATA / "kyc_documents" / "K*_*.png"))})
_SAMPLE_LOCK = threading.Lock()


def _sample_one(k: str) -> dict | None:
    """OCR one specimen applicant on demand (cached). Never blocks other applicants' requests."""
    if k in _SAMPLE_CACHE:
        return _SAMPLE_CACHE[k]
    if k not in _SAMPLE_IDS:
        return None
    with _SAMPLE_LOCK:
        if k in _SAMPLE_CACHE:
            return _SAMPLE_CACHE[k]
        base = DATA / "kyc_documents"
        files = [(Path(f).name, open(f, "rb").read()) for f in sorted(glob.glob(str(base / f"{k}_*.png")))]
        res = kyc.process_images(files)
        gst = res["extracted"].get("gst", {})
        res["applicant"] = k
        res["business"] = gst.get("trade_name") or res["extracted"].get("udyam", {}).get("enterprise_name") or k
        res["doc_files"] = [n for n, _ in files]
        _SAMPLE_CACHE[k] = res
        return res


def _sample_results():
    for k in _SAMPLE_IDS:
        _sample_one(k)
    return _SAMPLE_CACHE


@app.get("/api/kyc/samples")
def kyc_samples():
    """Instant: lists specimens; business/verdict appear as the background warm-up finishes."""
    out = []
    for k in _SAMPLE_IDS:
        c = _SAMPLE_CACHE.get(k)
        out.append({"applicant": k, "business": c["business"] if c else "", "verdict": c["verdict"] if c else None,
                    "docs": c["doc_files"] if c else sorted(Path(f).name for f in glob.glob(str(DATA / "kyc_documents" / f"{k}_*.png")))})
    return out


@app.get("/api/kyc/sample/{k}")
def kyc_sample(k: str):
    r = _sample_one(k)
    if not r:
        raise HTTPException(404)
    return r


@app.get("/api/kyc/sample-file/{name}")
def kyc_sample_file(name: str):
    p = DATA / "kyc_documents" / Path(name).name
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p)


@app.post("/api/kyc/verify")
async def kyc_verify(files: list[UploadFile] = File(...), gstin: str | None = Form(None), udyam: str | None = Form(None)):
    blobs = [(f.filename or "doc", await f.read()) for f in files]
    return kyc.process_images(blobs, gstin, udyam)


class ConsentReq(BaseModel):
    purposes: list[str]
    session: str | None = None
    language: str = "en"


@app.post("/api/consent")
def consent(r: ConsentReq):
    rec = {"id": "CN" + os.urandom(3).hex().upper(), "ts": dt.datetime.now().isoformat(timespec="seconds"), "purposes": r.purposes,
           "language": r.language, "retention": "Documents deleted 30 days after verification; order records kept as required by law",
           "withdrawable": True, "notice_version": "v1.0 (DPDP Act 2023)"}
    CONSENTS.append(rec)
    return rec


# ---------------- esign / payment mocks ----------------
@app.post("/api/esign/otp")
def esign_otp():
    return {"sent": True, "hint": "Demo OTP is 123456"}


@app.post("/api/esign/verify")
def esign_verify(r: IdReq):
    return {"ok": r.id == "123456", "signed_at": dt.datetime.now().isoformat(timespec="seconds"), "ref": "ESIGN-" + os.urandom(3).hex().upper()}


# ---------------- orders ----------------
class OrderReq(BaseModel):
    items: list[dict]
    contract: int = 12
    customer: dict
    kyc: dict | None = None
    consent: dict = {}
    payment: dict = {}
    session_id: str | None = None


@app.post("/api/orders")
def make_order(r: OrderReq):
    items = _clean_items(r.items)
    if r.contract not in (1, 6, 12, 24):
        raise HTTPException(422, "Contract must be 1, 6, 12 or 24 months.")
    o = orders.create_order(items, r.contract, r.customer, r.kyc, r.consent, r.payment)
    if r.session_id and r.session_id in advisor.SESSIONS:
        advisor.SESSIONS[r.session_id]["ordered"] = o["id"]     # no longer an abandoned lead
    return o


@app.get("/api/orders/{oid}")
def get_order(oid: str):
    if oid not in orders.ORDERS:
        raise HTTPException(404, "order not found")
    return orders.view(oid)


@app.post("/api/orders/{oid}/advance")
def adv_order(oid: str, days: int = 1):
    if oid not in orders.ORDERS:
        raise HTTPException(404)
    return orders.advance(oid, days)


@app.get("/api/orders")
def list_orders():
    return [{"id": o["id"], "customer": o["customer"].get("business"), "monthly": o["quote"]["monthly_total"]} for o in orders.ORDERS.values()]


# ---------------- back office ----------------
@app.get("/api/ops/analytics")
def ops_analytics():
    return ops.analytics()


@app.get("/api/ops/leads")
def ops_leads(limit: int = 50, segment: str | None = None):
    return ops.score_leads(limit, segment)


@app.get("/api/ops/handoffs")
def ops_handoffs():
    return ops.HANDOFFS


@app.post("/api/ops/handoffs/{hid}/status")
def ops_handoff_status(hid: str, status: str):
    for h in ops.HANDOFFS:
        if h["id"] == hid:
            h["status"] = status
            return h
    raise HTTPException(404)


# ---------------- Scam Shield ----------------
class ScamReq(BaseModel):
    text: str
    lang: str = "en"


@app.post("/api/scam/check")
def scam_check(r: ScamReq):
    return scam.analyze(r.text, r.lang)


@app.post("/api/scam/check-image")
async def scam_check_image(file: UploadFile = File(...), lang: str = Form("en")):
    try:
        txt = wa._ocr_plain(await file.read())
    except Exception:
        raise HTTPException(400, "Could not read that image. Please upload a clear PNG or JPG screenshot.")
    res = scam.analyze(txt, lang, from_screenshot=True)
    res["ocr_text"] = txt[:1200]
    return res


# ---------------- Network Reality Check ----------------
class NetReq(BaseModel):
    pincode: str
    city: str | None = None


@app.post("/api/network/check")
def net_check(r: NetReq):
    return network.check(r.pincode, r.city)


class AdaptReq(BaseModel):
    items: list[dict]


@app.post("/api/network/adapt")
def net_adapt(r: AdaptReq):
    r.items = _clean_items(r.items)
    items, removed = network.adapt_for_airfiber(r.items)
    return {"items": items, "removed": removed}


# ---------------- scheduler / continuity / branch / tickets ----------------
def _o(oid: str):
    if oid not in orders.ORDERS:
        raise HTTPException(404, "order not found")


@app.get("/api/orders/{oid}/slots")
def o_slots(oid: str):
    _o(oid)
    return orders.slots(oid)


class SlotReq(BaseModel):
    slot_id: str


@app.post("/api/orders/{oid}/schedule")
def o_schedule(oid: str, r: SlotReq):
    _o(oid)
    try:
        return orders.schedule(oid, r.slot_id)
    except ValueError as e:
        raise HTTPException(409, str(e))


@app.get("/api/orders/{oid}/continuity")
def o_cont(oid: str, sales_per_hour: float | None = None, dependent_pct: float = 60, hours: float = 4):
    _o(oid)
    return orders.continuity(oid, sales_per_hour, dependent_pct, hours)


@app.post("/api/orders/{oid}/outage")
def o_outage(oid: str, action: str):
    _o(oid)
    return orders.outage(oid, action)


@app.post("/api/orders/{oid}/failover")
def o_failover(oid: str):
    _o(oid)
    try:
        return orders.add_failover(oid)
    except ValueError as e:
        raise HTTPException(409, str(e))


class BranchReq(BaseModel):
    name: str
    city: str
    pincode: str
    staff: int | None = None
    confirm: bool = False


@app.post("/api/orders/{oid}/branch")
def o_branch(oid: str, r: BranchReq):
    _o(oid)
    return orders.branch(oid, r.name, r.city, r.pincode, r.staff, r.confirm)


class TicketReq(BaseModel):
    kind: str = "other"
    detail: str = ""


@app.post("/api/orders/{oid}/tickets")
def o_ticket(oid: str, r: TicketReq):
    _o(oid)
    return orders.create_ticket(oid, r.kind, r.detail)


# ---------------- lead rescue ----------------
@app.get("/api/ops/rescue")
def ops_rescue():
    out = []
    for s in advisor.SESSIONS.values():
        if s.get("reco") and not s.get("ordered"):
            q = s["reco"]["quote"]
            out.append({"session": s["id"], "channel": s["channel"], "business": s["slots"].get("business_name") or s["slots"].get("business_type", "-"),
                        "city": s["slots"].get("city", "-"), "monthly": q["monthly_total"], "lang": s["lang"],
                        "nudge": f"Your bundle is saved at Rs {q['monthly_total']:,}/month. One step left: KYC on WhatsApp (2 minutes). Reply YES."})
    return out


# ---------------- WhatsApp ----------------
class WaSim(BaseModel):
    phone: str = "+919800000001"
    text: str = ""


@app.post("/api/whatsapp/sim")
def wa_sim(r: WaSim):
    return {"replies": wa.handle(r.phone, r.text)}


@app.post("/api/whatsapp/sim-image")
async def wa_sim_image(phone: str = Form(...), file: UploadFile = File(...), text: str = Form("")):
    return {"replies": wa.handle(phone, text, await file.read())}


@app.post("/api/whatsapp/nudge")
def wa_nudge(r: WaSim):
    return {"replies": wa.nudge(r.phone)}


@app.post("/api/whatsapp/webhook")
async def wa_webhook(request: Request):
    """Twilio-compatible webhook (application/x-www-form-urlencoded: From, Body). Point a WhatsApp sandbox here."""
    form = await request.form()
    replies = wa.handle(str(form.get("From", "wa:unknown")), str(form.get("Body", "")))
    esc = lambda x: x.replace("&", "&amp;").replace("<", "&lt;")
    body = "".join(f"<Message>{esc(r['text'])}</Message>" for r in replies)
    return Response(f"<?xml version='1.0' encoding='UTF-8'?><Response>{body}</Response>", media_type="application/xml")


# ---------------- static frontend (production) ----------------
_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/") or path == "api":
            raise HTTPException(404, "Unknown API route")
        f = (_dist / path).resolve()
        if path and f.is_file() and _dist.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(_dist / "index.html")
