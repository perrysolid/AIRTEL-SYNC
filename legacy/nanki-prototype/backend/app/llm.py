"""Optional Claude integration. Everything degrades gracefully to the rules engine when no key is configured."""
import json, os
from .i18n import LANGS

MODEL = os.getenv("SYNC_MODEL", "claude-haiku-5-5")


def _client():
    import anthropic
    return anthropic.Anthropic()


import re


def redact(text: str) -> str:
    """Privacy promise: identifiers never reach an AI model. Mask GSTIN, Udyam, PAN, phone and long digit runs."""
    t = re.sub(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b", "[GSTIN]", text, flags=re.I)
    t = re.sub(r"UDYAM-[A-Z]{2}-\d{2}-\d{7}", "[UDYAM]", t, flags=re.I)
    t = re.sub(r"\b[A-Z]{5}\d{4}[A-Z]\b", "[PAN]", t)
    t = re.sub(r"(?<!\d)(\+?91[\s-]?)?[6-9]\d{9}(?!\d)", "[PHONE]", t)
    return re.sub(r"\d{8,}", "[NUMBER]", t)


def extract_slots(text: str, stage: str) -> dict:
    text = redact(text)
    prompt = ("Extract facts about a small Indian business from the user's message (any Indian language or Hinglish). "
              "Return ONLY JSON with any of these keys: business_type (English phrase), city, employees (int), sites (int), "
              "current_internet (one of: Mobile hotspot, Home broadband, Business broadband, Leased line), spend (int INR/month), "
              "needs (list from: internet,payments,whatsapp,email,security,cctv,backup,website,calls,sms,vehicles,machines). "
              f"Current question stage: {stage}.\nMessage: {text}")
    r = _client().messages.create(model=MODEL, max_tokens=300, messages=[{"role": "user", "content": prompt}])
    raw = r.content[0].text
    d = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
    from .recommend import canonical_type
    if d.get("business_type"):
        d["business_type"] = canonical_type(d["business_type"]) or d["business_type"]
    return {k: v for k, v in d.items() if v not in (None, "", [])}


def translate_reasons(items: list[dict], lang: str):
    texts = [i["reason"] for i in items]
    prompt = (f"Translate each line into {LANGS[lang]} for a small-shop owner: simple, warm, keep product names and numbers as is. "
              "Return ONLY a JSON array of strings in the same order.\n" + json.dumps(texts, ensure_ascii=False))
    r = _client().messages.create(model=MODEL, max_tokens=2000, messages=[{"role": "user", "content": prompt}])
    raw = r.content[0].text
    out = json.loads(raw[raw.index("["): raw.rindex("]") + 1])
    for it, tr in zip(items, out):
        it["reason"] = tr
