"""Back-office: lead propensity model, funnel/segment analytics, advisor hand-offs to sales & channel partners."""
from __future__ import annotations
import uuid, datetime as dt
import numpy as np
import pandas as pd
from .data import leads, CITY_TIER

_model = None
_FEATS_CAT = ["segment", "lead_source", "preferred_language", "current_internet", "annual_turnover_band", "city_tier", "has_gstin", "has_udyam"]
_FEATS_NUM = ["log_emp", "num_sites", "log_spend", "n_interest"]
HANDOFFS: list[dict] = []

PARTNERS = {  # city -> partner pool (synthetic)
    "default": ["Sunrise Digital Partners", "Local Reseller Network"],
    "Pune": ["Pune TechServe"], "Mumbai": ["Konkan Telecom Associates"], "Delhi": ["Capital Net Solutions"],
    "Bengaluru": ["Namma Connect"], "Chennai": ["Marina Networks"], "Hyderabad": ["Deccan Digital"], "Kolkata": ["Hooghly Infocom"],
    "Ahmedabad": ["Sabarmati Systems"], "Jaipur": ["Pink City Telecom"], "Lucknow": ["Awadh Digital"], "Kochi": ["Malabar Net"],
}


def _prep(df: pd.DataFrame) -> pd.DataFrame:
    d = pd.DataFrame(index=df.index)
    for c in _FEATS_CAT:
        d[c] = df[c].astype(str)
    d["log_emp"] = np.log1p(df.employee_count)
    d["num_sites"] = df.num_sites
    d["log_spend"] = np.log1p(df.monthly_telecom_spend_inr.fillna(0))
    d["n_interest"] = df.products_of_interest.fillna("").str.count(";") + (df.products_of_interest.fillna("") != "")
    return d


def train() -> dict:
    """Logistic regression on 5,000 leads; chronological hold-out to report an honest AUC."""
    global _model
    from sklearn.compose import ColumnTransformer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    df = leads.sort_values("created_date").reset_index(drop=True)
    X, y = _prep(df), (df.outcome == "Activated").astype(int)
    pre = ColumnTransformer([("c", OneHotEncoder(handle_unknown="ignore"), _FEATS_CAT), ("n", StandardScaler(), _FEATS_NUM)])
    pipe = Pipeline([("p", pre), ("m", LogisticRegression(max_iter=600, C=0.6, class_weight=None))])
    cut = int(len(df) * 0.75)
    pipe.fit(X.iloc[:cut], y.iloc[:cut])
    auc = roc_auc_score(y.iloc[cut:], pipe.predict_proba(X.iloc[cut:])[:, 1])
    # top-decile lift on hold-out
    p = pipe.predict_proba(X.iloc[cut:])[:, 1]
    top = np.argsort(-p)[: max(1, len(p) // 10)]
    lift = y.iloc[cut:].iloc[top].mean() / max(y.iloc[cut:].mean(), 1e-9)
    pipe.fit(X, y)
    names = pipe.named_steps["p"].get_feature_names_out()
    _model = {"pipe": pipe, "names": names, "auc": float(auc), "lift": float(lift), "base": float(y.mean())}
    return {"auc": round(auc, 3), "top_decile_lift": round(lift, 2), "base_rate": round(float(y.mean()), 4)}


def _ensure():
    if _model is None:
        train()


def _reasons(row: pd.DataFrame, k: int = 3) -> list[str]:
    pipe, names = _model["pipe"], _model["names"]
    xt = pipe.named_steps["p"].transform(row)
    coefs = pipe.named_steps["m"].coef_[0]
    contrib = np.asarray(xt.todense()).ravel() * coefs if hasattr(xt, "todense") else xt.ravel() * coefs
    idx = np.argsort(-np.abs(contrib))[: k + 3]
    out = []
    for i in idx:
        n = names[i].split("__", 1)[-1]
        if abs(contrib[i]) < 0.08:
            continue
        out.append(("▲ " if contrib[i] > 0 else "▼ ") + n.replace("_", " ").replace("segment ", "").replace("has gstin ", "GSTIN: ").replace("lead source ", "").replace("has udyam ", "Udyam: ").replace("city tier ", "Tier ").replace("current internet ", "uses "))
        if len(out) == k:
            break
    return out


def score_leads(limit: int = 60, segment: str | None = None, only_open: bool = True) -> dict:
    _ensure()
    df = leads.copy()
    if only_open:
        df = df[df.outcome != "Activated"]
        df = df[~df.stage_reached.isin(["KYC complete"]) | (df.drop_reason != "Customer cancelled before install")]
    if segment:
        df = df[df.segment == segment]
    X = _prep(df)
    df["score"] = _model["pipe"].predict_proba(X)[:, 1]
    seg_val = leads[leads.outcome == "Activated"].groupby("segment").monthly_bundle_value_inr.mean()
    df["exp_value"] = df.score * df.segment.map(seg_val)
    # recoverable-reason boost: leads that dropped for reasons a better journey fixes
    fixable = {"Quote too complex to understand", "Quote took too long to arrive", "Missing GST or Udyam document", "Found paperwork too long",
               "Document details did not match", "Owner had no time for a visit", "Visit not scheduled by sales", "Authorised signatory not available"}
    df["fixable"] = df.drop_reason.isin(fixable)
    df["priority"] = np.where(df.score >= df.score.quantile(.9), "Call now", np.where(df.score >= df.score.quantile(.6), "Nurture on WhatsApp", "Self-serve only"))
    top = df.sort_values("exp_value", ascending=False).head(limit)
    rows = []
    for idx, r in top.iterrows():
        rows.append({"lead_id": r.lead_id, "business": r.business_name, "type": r.business_type, "segment": r.segment, "city": r.city,
                     "source": r.lead_source, "stage": r.stage_reached, "drop_reason": r.drop_reason if isinstance(r.drop_reason, str) else "",
                     "score": round(float(r.score), 3), "exp_value": int(r.exp_value), "priority": r.priority, "fixable": bool(r.fixable),
                     "language": r.preferred_language, "has_gstin": r.has_gstin, "reasons": _reasons(_prep(df.loc[[idx]]))})
    return {"leads": rows, "model": {"auc": round(_model["auc"], 3), "lift": round(_model["lift"], 2), "base": round(_model["base"], 4)},
            "pool": int(len(df)), "priority_counts": df.priority.value_counts().to_dict(),
            "recoverable_monthly_value": int((df[df.fixable].exp_value).sum())}


def analytics() -> dict:
    d = leads.copy()
    d["act"] = d.outcome == "Activated"
    order = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"]
    reached = [int((d.stage_reached.map(order.index) >= i).sum()) for i in range(len(order))]
    funnel = [{"stage": s, "count": c, "pct_prev": round(100 * c / reached[i - 1]) if i else 100} for i, (s, c) in enumerate(zip(order, reached))]
    seg = []
    for sg, g in d.groupby("segment"):
        a = g[g.act]
        seg.append({"segment": sg, "leads": len(g), "share": round(100 * len(g) / len(d), 1), "activation": round(100 * g.act.mean(), 1),
                    "avg_value": int(a.monthly_bundle_value_inr.mean()), "cac": int(g.acquisition_cost_inr.sum() / max(len(a), 1)),
                    "churn": round(100 * (a.churned_within_6_months == "Y").mean(), 1), "nps": round(a.nps_score.mean(), 1),
                    "days": round(a.days_lead_to_activation.mean(), 1),
                    "payback_months": round(g.acquisition_cost_inr.sum() / max(len(a), 1) / max(a.monthly_bundle_value_inr.mean(), 1), 1)})
    src = []
    for sc, g in d.groupby("lead_source"):
        a = g[g.act]
        src.append({"source": sc, "leads": len(g), "activation": round(100 * g.act.mean(), 1),
                    "cac": int(g.acquisition_cost_inr.sum() / max(len(a), 1)), "churn": round(100 * (a.churned_within_6_months == "Y").mean(), 1)})
    drops = d[~d.act].drop_reason.value_counts().head(10)
    fixable_n = int(d[~d.act].drop_reason.isin(["Quote too complex to understand", "Quote took too long to arrive", "Missing GST or Udyam document",
                    "Found paperwork too long", "Document details did not match", "Owner had no time for a visit", "Visit not scheduled by sales",
                    "Authorised signatory not available", "Unreachable after 3 attempts"]).sum())
    return {
        "funnel": funnel, "segments": seg, "sources": src,
        "drop_reasons": [{"reason": k, "count": int(v)} for k, v in drops.items()],
        "all_drop_reasons": [{"reason": k, "count": int(v)} for k, v in d[~d.act].drop_reason.value_counts().items()],
        "gstin": {"with": round(100 * d[d.has_gstin == "Y"].act.mean(), 1), "without": round(100 * d[d.has_gstin == "N"].act.mean(), 1),
                  "leads_without": int((d.has_gstin == "N").sum())},
        "kpis": {"leads": len(d), "activated": int(d.act.sum()), "conv": round(100 * d.act.mean(), 1),
                 "days": round(d[d.act].days_lead_to_activation.mean(), 1), "calls": round(d[d.act].customer_follow_up_calls.mean(), 1),
                 "cac": int(d.acquisition_cost_inr.sum() / d.act.sum()), "churn": round(100 * (d[d.act].churned_within_6_months == "Y").mean(), 1),
                 "nps": round(d[d.act].nps_score.mean(), 1), "fixable_drops": fixable_n},
    }


def create_handoff(session: dict, reason: str) -> dict:
    _ensure()
    sl = session["slots"]
    city = sl.get("city", "")
    partner = (PARTNERS.get(city) or PARTNERS["default"])[0]
    slots = session["slots"]
    row = pd.DataFrame([{
        "segment": {"micro": "Micro retail & services", "prof": "Professional offices", "multi": "Small multi-site businesses", "mfg": "Small manufacturers"}.get(
            session.get("reco", {}) and session["reco"]["segment"] or "micro"),
        "lead_source": "WhatsApp campaign" if session["channel"] == "whatsapp" else "Website form",
        "preferred_language": {"hi": "Hindi", "en": "English", "mr": "Marathi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "gu": "Gujarati",
                               "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi"}[session["lang"]],
        "current_internet": slots.get("current_internet", "Mobile hotspot"), "annual_turnover_band": "1.5 - 5 cr", "city_tier": CITY_TIER.get(city, 2),
        "has_gstin": "Y" if slots.get("has_gstin") else "N", "has_udyam": "N", "employee_count": slots.get("employees", 3),
        "num_sites": slots.get("sites", 1), "monthly_telecom_spend_inr": slots.get("spend", 1500),
        "products_of_interest": ";".join(session.get("needs", []))}])
    sc = float(_model["pipe"].predict_proba(_prep(row))[:, 1][0])
    h = {"id": "H" + uuid.uuid4().hex[:6].upper(), "created": dt.datetime.now().isoformat(timespec="seconds"), "reason": reason,
         "channel": session["channel"], "language": session["lang"], "city": city, "business_type": slots.get("business_type", "-"),
         "employees": slots.get("employees"), "sites": slots.get("sites"), "needs": session.get("needs", []), "score": round(sc, 3),
         "priority": "Call now" if sc > 0.12 else "Nurture", "partner": partner, "sla": "2 working hours",
         "transcript": [m["text"] for m in session["messages"] if m["role"] == "user"][-6:], "status": "New"}
    HANDOFFS.insert(0, h)
    return h
