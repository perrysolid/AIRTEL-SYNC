import { CASE_TODAY } from "./data";
import { findGstinByBusiness, findUdyamByBusiness, lookupGstin, lookupUdyam } from "./registry";
import { DOC_LABELS, type DocType, type ExtractedDoc, type KycCheck, type KycResult } from "./kyc-types";

/**
 * Smart KYC rule engine. Takes whatever the extractor read off each document
 * and cross-checks it against itself, the other documents and the mock
 * government registries. Every check produces a plain-language result and,
 * where the owner can fix it, a concrete next step.
 */

export const ADDRESS_PROOF_MAX_AGE_DAYS = 90;

/** Hard failures go to a human reviewer instead of the owner. */
const HARD_FAILS = new Set(["gstin_checksum", "gstin_status", "gstin_registry", "gst_name_registry", "udyam_registry"]);

export function normName(s?: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\(prop\.?[^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\b(llp|pvt|private|ltd|limited|the|m\/s)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-set similarity in [0,1]; robust to word order and suffixes. */
export function nameSimilarity(a?: string | null, b?: string | null): number {
  const ta = new Set(normName(a).split(" ").filter(Boolean));
  const tb = new Set(normName(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / Math.max(ta.size, tb.size);
}

const sameName = (a?: string | null, b?: string | null) => nameSimilarity(a, b) >= 0.8;

/** "Neha Kaur (Prop. Vindhya Tours)" -> { person: "Neha Kaur", firm: "Vindhya Tours" } */
export function splitLegalName(legal?: string | null): { person?: string; firm?: string } {
  const m = (legal ?? "").match(/^(.*?)\s*\(\s*prop\.?\s*(.*?)\)\s*$/i);
  return m ? { person: m[1].trim(), firm: m[2].trim() } : { firm: legal ?? undefined };
}

/** Compares proprietor and firm separately, so "X (Prop. A)" != "X (Prop. B)". */
function sameLegalName(a: string, b: string): boolean {
  const pa = splitLegalName(a);
  const pb = splitLegalName(b);
  const personOk = !pa.person && !pb.person ? true : sameName(pa.person, pb.person);
  return personOk && sameName(pa.firm, pb.firm);
}

const pin = (s?: string | null) => (s ?? "").replace(/\s+/g, "").match(/(\d{6})(?!.*\d)/)?.[1];

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function parseDate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
  if (!m) return undefined;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+05:30`);
  return isNaN(d.getTime()) ? undefined : d;
}

export type KycDocs = Partial<Record<DocType, ExtractedDoc>>;

export function validateKyc(docs: KycDocs, today: Date = CASE_TODAY): KycResult {
  const checks: KycCheck[] = [];
  const add = (c: KycCheck) => checks.push(c);
  const gst = docs.gst_certificate;
  const ud = docs.udyam_certificate;
  const addr = docs.address_proof;
  const sig = docs.signatory_id;

  // --- Presence & legibility -------------------------------------------------
  for (const t of ["gst_certificate", "address_proof", "signatory_id"] as DocType[]) {
    if (!docs[t]) {
      add({ id: `${t}_missing`, doc: t, status: "fail", title: `${DOC_LABELS[t]} missing`, detail: `We need your ${DOC_LABELS[t].toLowerCase()} to activate business services.`, fix: `Upload your ${DOC_LABELS[t].toLowerCase()} or fetch it from DigiLocker` });
    }
  }
  if (!ud) {
    add({ id: "udyam_missing", doc: "udyam_certificate", status: "warn", title: "Udyam certificate not provided", detail: "Udyam is optional for activation, but registered MSMEs are verified faster.", fix: "If you are Udyam-registered, add the certificate or just type the Udyam number" });
  }
  const legible = (t: DocType) => {
    const d = docs[t];
    if (!d) return false;
    if (!d.legible || d.confidence < 0.5) {
      add({ id: `${t}_illegible`, doc: t, status: "fail", title: `${DOC_LABELS[t]} is not readable`, detail: `The photo looks ${d.qualityIssues.join(", ") || "unclear"}, so we can't read it reliably.`, fix: `Retake the photo of your ${DOC_LABELS[t].toLowerCase()} in good light, flat and in focus` });
      return false;
    }
    if (d.qualityIssues.length) {
      add({ id: `${t}_quality`, doc: t, status: "pass", title: `${DOC_LABELS[t]} read despite image issues`, detail: `Auto-corrected: ${d.qualityIssues.join(", ")}.` });
    }
    return true;
  };

  // --- GST certificate vs registry -------------------------------------------
  let gstRecord: ReturnType<typeof lookupGstin>["record"];
  if (gst && legible("gst_certificate")) {
    const f = gst.fields;
    if (!f.gstin) {
      add({ id: "gstin_missing", doc: "gst_certificate", status: "fail", title: "GSTIN not found on certificate", detail: "We couldn't find a GSTIN on the uploaded document.", fix: "Upload the GST registration certificate (REG-06) or type your GSTIN" });
    } else {
      const look = lookupGstin(f.gstin);
      // A blurry photo yields guessed characters; that's a retake, not a forged number.
      const shaky = gst.qualityIssues.some((q) => /blur|low light|dark|glare|cropped/i.test(q));
      if (shaky && !look.record) {
        add({ id: "gst_certificate_illegible", doc: "gst_certificate", status: "fail", title: "GSTIN not clearly readable", detail: `The photo looks ${gst.qualityIssues.join(", ")} and the number we read (${look.gstin}) doesn't check out, so we won't guess.`, fix: "Retake the photo of your GST certificate in good light, flat and in focus" });
      } else if (!look.check.formatOk) {
        add({ id: "gstin_format", doc: "gst_certificate", status: "fail", title: "GSTIN format invalid", detail: look.check.error ?? "Invalid format", fix: "Check the GSTIN and upload a clearer copy" });
      } else if (!look.check.checksumOk) {
        add({ id: "gstin_checksum", doc: "gst_certificate", status: "fail", title: "GSTIN check digit fails", detail: `${look.gstin} fails the GSTIN checksum — one character is wrong or the number has been altered.`, fix: "Our team will verify this manually; please keep the original certificate handy" });
      } else {
        add({ id: "gstin_checksum", doc: "gst_certificate", status: "pass", title: "GSTIN format and checksum valid", detail: `${look.gstin} · state ${look.check.state}${look.ocrCorrected ? " · 1 misread character auto-corrected via checksum + registry" : ""}` });
        if (!look.record) {
          add({ id: "gstin_registry", doc: "gst_certificate", status: "fail", title: "GSTIN not found in GST registry", detail: "The number is well-formed but isn't registered.", fix: "Our team will verify this manually" });
        } else {
          gstRecord = look.record;
          const r = look.record;
          if (r.status !== "Active") {
            add({ id: "gstin_status", doc: "gst_certificate", status: "fail", title: `GSTIN is ${r.status}`, detail: `The GST registry shows this registration as ${r.status.toLowerCase()}. Business products that need GST can't be activated on it.`, fix: "Reactivate your GST registration, or continue with products that don't need GST" });
          } else {
            add({ id: "gstin_status", doc: "gst_certificate", status: "pass", title: "GSTIN active in registry", detail: `Registered since ${r.registration_date} · ${r.constitution}` });
          }
          if (f.legalName && !sameLegalName(f.legalName, r.legal_name)) {
            add({ id: "gst_name_registry", doc: "gst_certificate", status: "fail", title: "Name on certificate doesn't match GST registry", detail: `Certificate says "${f.legalName}" but the registry says "${r.legal_name}".`, fix: "Our team will verify this manually" });
          } else if (f.legalName) {
            add({ id: "gst_name_registry", doc: "gst_certificate", status: "pass", title: "Legal name matches registry", detail: r.legal_name });
          }
          if (pin(f.address) && pin(r.principal_place_of_business) && pin(f.address) !== pin(r.principal_place_of_business)) {
            add({ id: "gst_address_registry", doc: "gst_certificate", status: "warn", title: "Address PIN differs from registry", detail: `Certificate PIN ${pin(f.address)} vs registry ${pin(r.principal_place_of_business)}.`, fix: "Confirm your installation address" });
          }
        }
      }
    }
  }

  // --- Registry recovery: unreadable GSTIN / missing Udyam ----------------------
  // The other documents usually name the business and its address, which is
  // enough to find the registration ourselves and ask the owner to confirm it.
  const otherNames = [ud?.fields.enterpriseName, addr?.fields.billedTo, sig?.fields.forBusiness];
  if (!gstRecord && (!gst || !gst.legible || gst.confidence < 0.5 || !gst.fields.gstin)) {
    const hit = findGstinByBusiness([gst?.fields.tradeName, gst?.fields.legalName, ...otherNames], pin(addr?.fields.address));
    if (hit) {
      add({ id: "gstin_suggested", doc: "gst_certificate", status: "warn", title: "We found your GSTIN in the registry", detail: `${hit.gstin} · ${hit.legal_name} · ${hit.status}, at the same PIN as your bill.`, fix: `Confirm ${hit.gstin} is yours and we'll finish the GST checks without a new photo` });
    }
  }
  const udyamNumberKnown = !!ud?.fields.udyamNumber;
  if (!udyamNumberKnown && gstRecord) {
    const city = gstRecord.principal_place_of_business.split(",").at(-2)?.trim();
    const hit = findUdyamByBusiness([gstRecord.trade_name, ud?.fields.enterpriseName, ...otherNames], gstRecord.state, city);
    if (hit) {
      add({ id: "udyam_suggested", doc: "udyam_certificate", status: "warn", title: "We found your Udyam registration", detail: `${hit.udyam_number} · ${hit.enterprise_name} · ${hit.enterprise_type} enterprise in ${hit.city}.`, fix: `Confirm ${hit.udyam_number} is yours to add it — no certificate upload needed` });
    }
  }

  // --- Udyam -------------------------------------------------------------------
  if (ud && legible("udyam_certificate")) {
    const f = ud.fields;
    if (!f.udyamNumber) {
      add({ id: "udyam_number_missing", doc: "udyam_certificate", status: "fail", title: "Udyam number missing on certificate", detail: "The certificate has no registration number printed, so we can't verify it.", fix: "Type your Udyam number (UDYAM-XX-00-0000000) or re-download the certificate from the Udyam portal" });
    } else {
      const look = lookupUdyam(f.udyamNumber);
      if (!look.check.formatOk) {
        add({ id: "udyam_format", doc: "udyam_certificate", status: "fail", title: "Udyam number format invalid", detail: look.check.error ?? "", fix: "Check the number and re-upload" });
      } else if (!look.record) {
        add({ id: "udyam_registry", doc: "udyam_certificate", status: "fail", title: "Udyam number not found in registry", detail: `${look.udyam} isn't in the Udyam registry.`, fix: "Our team will verify this manually" });
      } else {
        const r = look.record;
        add({ id: "udyam_registry", doc: "udyam_certificate", status: "pass", title: "Udyam registration verified", detail: `${r.enterprise_name} · ${r.enterprise_type} enterprise · ${r.city}` });
        if (f.enterpriseName && !sameName(f.enterpriseName, r.enterprise_name)) {
          add({ id: "udyam_name_registry", doc: "udyam_certificate", status: "fail", title: "Udyam name doesn't match registry", detail: `"${f.enterpriseName}" vs "${r.enterprise_name}".`, fix: "Our team will verify this manually" });
        }
        if (f.majorActivity && r.major_activity && f.majorActivity.toLowerCase() !== r.major_activity.toLowerCase()) {
          add({ id: "udyam_activity", doc: "udyam_certificate", status: "warn", title: "Activity differs from Udyam registry", detail: `Certificate shows "${f.majorActivity}", registry shows "${r.major_activity}". Doesn't block activation.` });
        }
        if (gstRecord && r.state !== gstRecord.state) {
          add({ id: "udyam_gst_state", doc: "cross", status: "fail", title: "Udyam and GST are in different states", detail: `Udyam: ${r.state}, GST: ${gstRecord.state}.`, fix: "Upload the Udyam certificate for this business location" });
        }
      }
    }
  }

  // --- Address proof -------------------------------------------------------------
  if (addr && legible("address_proof")) {
    const f = addr.fields;
    const billDate = parseDate(f.billDate);
    if (!billDate) {
      add({ id: "address_date", doc: "address_proof", status: "fail", title: "Bill date not readable", detail: "We couldn't read the bill date.", fix: "Upload a clearer copy of a recent bill" });
    } else {
      const age = daysBetween(today, billDate);
      if (age > ADDRESS_PROOF_MAX_AGE_DAYS) {
        add({ id: "address_date", doc: "address_proof", status: "fail", title: `Address proof is ${age} days old`, detail: `Bills must be from the last ${ADDRESS_PROOF_MAX_AGE_DAYS} days (this one is dated ${f.billDate}).`, fix: "Upload your latest electricity, water or broadband bill" });
      } else if (age < 0) {
        add({ id: "address_date", doc: "address_proof", status: "fail", title: "Bill is dated in the future", detail: `Dated ${f.billDate}.`, fix: "Upload a genuine recent bill" });
      } else {
        add({ id: "address_date", doc: "address_proof", status: "pass", title: "Address proof is recent", detail: `Dated ${f.billDate} (${age} days ago)` });
      }
    }
    const firm = gst?.fields.tradeName ?? splitLegalName(gst?.fields.legalName).firm ?? gstRecord?.trade_name;
    if (firm && f.billedTo) {
      const ok = sameName(f.billedTo, firm) || sameName(f.billedTo, splitLegalName(gstRecord?.legal_name).person);
      add(ok
        ? { id: "address_name", doc: "address_proof", status: "pass", title: "Bill is in the business's name", detail: f.billedTo }
        : { id: "address_name", doc: "address_proof", status: "fail", title: "Bill is in a different name", detail: `Billed to "${f.billedTo}", business is "${firm}".`, fix: "Upload a bill in the business or proprietor's name, or a rent agreement" });
    }
    const gstPin = pin(gst?.fields.address) ?? pin(gstRecord?.principal_place_of_business);
    if (gstPin && pin(f.address)) {
      add(pin(f.address) === gstPin
        ? { id: "address_pin", doc: "address_proof", status: "pass", title: "Address matches GST registration", detail: `PIN ${gstPin}` }
        : { id: "address_pin", doc: "address_proof", status: "warn", title: "Bill address differs from GST address", detail: `PIN ${pin(f.address)} vs ${gstPin}. Fine if this is an additional site.`, fix: "Confirm this is the installation address" });
    }
  }

  // --- Signatory -------------------------------------------------------------------
  if (sig && legible("signatory_id")) {
    const f = sig.fields;
    const valid = parseDate(f.validTill);
    if (valid && valid < today) {
      add({ id: "signatory_expired", doc: "signatory_id", status: "fail", title: "Signatory ID has expired", detail: `Valid till ${f.validTill}.`, fix: "Upload a valid ID, or verify with Aadhaar e-KYC via DigiLocker" });
    } else if (valid) {
      add({ id: "signatory_valid", doc: "signatory_id", status: "pass", title: "Signatory ID valid", detail: `${f.signatoryName ?? ""} · valid till ${f.validTill}` });
    }
    const firm = gst?.fields.tradeName ?? gstRecord?.trade_name;
    if (f.forBusiness && firm && !sameName(f.forBusiness, firm)) {
      add({ id: "signatory_business", doc: "signatory_id", status: "fail", title: "Signatory ID is for a different business", detail: `ID is for "${f.forBusiness}", application is for "${firm}".`, fix: "Upload the ID of a signatory of this business" });
    }
    const constitution = gst?.fields.constitution ?? gstRecord?.constitution ?? "";
    const proprietor = splitLegalName(gst?.fields.legalName ?? gstRecord?.legal_name).person;
    if (/propriet/i.test(constitution) && proprietor && f.signatoryName) {
      add(sameName(f.signatoryName, proprietor)
        ? { id: "signatory_authority", doc: "signatory_id", status: "pass", title: "Signatory is the proprietor", detail: proprietor }
        : { id: "signatory_authority", doc: "signatory_id", status: "fail", title: "Signatory isn't the proprietor", detail: `GST shows ${proprietor} as proprietor; ID is for ${f.signatoryName}.`, fix: "The proprietor should sign, or upload an authorisation letter from them" });
    } else if (/partnership|llp/i.test(constitution) && f.designation && !/partner/i.test(f.designation)) {
      add({ id: "signatory_authority", doc: "signatory_id", status: "warn", title: "Signatory isn't listed as a partner", detail: `For an LLP the signatory is normally a designated partner; this ID says "${f.designation}".`, fix: "Add a partner authorisation letter (you can e-sign it in the next step)" });
    } else if (/private limited|company/i.test(constitution) && f.designation && !/director/i.test(f.designation)) {
      add({ id: "signatory_authority", doc: "signatory_id", status: "warn", title: "Board authorisation needed", detail: `For a company the signatory should be a director or carry a board resolution; this ID says "${f.designation}".`, fix: "Add a board resolution or director authorisation (you can e-sign it in the next step)" });
    }
  }

  // --- Cross-document consistency ---------------------------------------------------
  const names = [
    ["GST", gst?.fields.tradeName],
    ["Udyam", ud?.fields.enterpriseName],
  ].filter(([, n]) => n) as [string, string][];
  if (names.length === 2 && !sameName(names[0][1], names[1][1])) {
    add({ id: "cross_names", doc: "cross", status: "fail", title: "Business name differs across documents", detail: names.map(([k, n]) => `${k}: ${n}`).join(" · "), fix: "Upload documents for the same business" });
  }

  const fails = checks.filter((c) => c.status === "fail");
  const hard = fails.some((c) => HARD_FAILS.has(c.id));
  const verdict = hard ? "rejected" : fails.length ? "needs_attention" : "verified";
  const actions = [...new Set(checks.filter((c) => c.status !== "pass" && c.fix).map((c) => c.fix!))];
  const summary =
    verdict === "verified"
      ? `All documents verified (${checks.filter((c) => c.status === "pass").length} checks passed).`
      : verdict === "rejected"
        ? "We found a problem only our verification team can resolve. They'll call you within 4 working hours — no need to chase us."
        : `Almost there — ${fails.length} thing${fails.length > 1 ? "s" : ""} to fix.`;
  return { verdict, checks, summary, actions };
}
