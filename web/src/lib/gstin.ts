/**
 * GSTIN / Udyam identifier logic: format, checksum, state codes and
 * OCR-confusion repair. Pure functions — safe on client and server.
 */

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const UDYAM_STATE_CODES: Record<string, string> = {
  AP: "Andhra Pradesh", BR: "Bihar", DL: "Delhi", GJ: "Gujarat", KL: "Kerala", KR: "Karnataka",
  KA: "Karnataka", MH: "Maharashtra", MP: "Madhya Pradesh", PB: "Punjab", RJ: "Rajasthan",
  TN: "Tamil Nadu", TS: "Telangana", UP: "Uttar Pradesh", WB: "West Bengal",
};

// 2 digits state + PAN (5 letters, 4 digits, 1 letter) + entity no. + 'Z' + checksum.
// The hackathon PANs use 'X' as the 4th letter, which real PANs don't — accepted on purpose.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARSET.indexOf(first14[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

export interface GstinCheck {
  normalized: string;
  formatOk: boolean;
  checksumOk: boolean;
  stateCode?: string;
  state?: string;
  pan?: string;
  error?: string;
}

export function validateGstin(raw: string): GstinCheck {
  const normalized = (raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (normalized.length !== 15) {
    return { normalized, formatOk: false, checksumOk: false, error: `GSTIN must be 15 characters (got ${normalized.length})` };
  }
  const formatOk = GSTIN_RE.test(normalized);
  const stateCode = normalized.slice(0, 2);
  const state = GST_STATE_CODES[stateCode];
  if (!formatOk) return { normalized, formatOk, checksumOk: false, stateCode, state, error: "GSTIN format is invalid" };
  if (!state) return { normalized, formatOk, checksumOk: false, stateCode, error: `Unknown state code ${stateCode}` };
  const checksumOk = gstinCheckChar(normalized) === normalized[14];
  return {
    normalized,
    formatOk,
    checksumOk,
    stateCode,
    state,
    pan: normalized.slice(2, 12),
    error: checksumOk ? undefined : "Check digit doesn't match — a character is wrong or the number was altered",
  };
}

const TO_DIGIT: Record<string, string> = { O: "0", D: "0", Q: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "6", T: "7" };
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G", "7": "T", "4": "A" };

/**
 * Repairs common OCR confusions (O/0, I/1, S/5, B/8) using the positional
 * structure of a GSTIN, then lets the checksum arbitrate ambiguous positions.
 * Never "repairs" a number into validity by changing a non-confusable char,
 * so a genuinely altered GSTIN still fails the checksum.
 */
export function repairGstinOcr(raw: string): string {
  const s = (raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (s.length !== 15) return s;
  const chars = s.split("");
  const digitPos = [0, 1, 7, 8, 9, 10];
  const letterPos = [2, 3, 4, 5, 6, 11];
  for (const i of digitPos) chars[i] = TO_DIGIT[chars[i]] ?? chars[i];
  for (const i of letterPos) chars[i] = TO_LETTER[chars[i]] ?? chars[i];
  // Position 14 is always 'Z' by spec; OCR often reads it as 2 or 7.
  if (["2", "7"].includes(chars[13])) chars[13] = "Z";
  const base = chars.join("");
  if (validateGstin(base).checksumOk) return base;
  // Positions 12 and 14 are alphanumeric: try confusable swaps there.
  const swaps: Record<string, string> = { "0": "O", O: "0", "1": "I", I: "1", "5": "S", S: "5", "8": "B", B: "8", "2": "Z", Z: "2" };
  for (const i of [12, 14]) {
    const alt = swaps[chars[i]];
    if (!alt) continue;
    const c = [...chars];
    c[i] = alt;
    if (validateGstin(c.join("")).checksumOk) return c.join("");
  }
  return base;
}

const UDYAM_RE = /^UDYAM-([A-Z]{2})-(\d{2})-(\d{7})$/;

export interface UdyamCheck {
  normalized: string;
  formatOk: boolean;
  state?: string;
  error?: string;
}

export function validateUdyam(raw: string): UdyamCheck {
  const normalized = (raw || "").toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
  const m = normalized.match(UDYAM_RE);
  if (!m) return { normalized, formatOk: false, error: "Udyam number must look like UDYAM-XX-00-0000000" };
  const state = UDYAM_STATE_CODES[m[1]];
  if (!state) return { normalized, formatOk: false, error: `Unknown state code ${m[1]}` };
  return { normalized, formatOk: true, state };
}
