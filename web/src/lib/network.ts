import crypto from "node:crypto";
import { product } from "./catalogue";
import { tierForCity } from "./profile";

/**
 * Network Reality Check: tells the owner what can actually be installed at their address BEFORE they pay.
 *
 * DEMO NOTE: the data pack has no coverage API, so availability is a deterministic simulation keyed on the
 * pincode (same pincode -> same answer) with tier-based odds. Every response is flagged `simulated`.
 */

export const FIXED_LINES = ["P01", "P02", "P03", "P05", "P06"];
/** Products whose catalogue rules need a fixed line, so they cannot ride on 5G AirFiber alone. */
export const NEEDS_FIXED = ["P09", "P10", "P11", "P21"];

export interface NetworkOption {
  key: "fibre" | "airfiber" | "leased";
  name: string;
  productIds: string[];
  available: boolean;
  installDays: number;
  speed: string;
  note: string;
  /** 5G signal quality 0-100 (AirFiber only). */
  signal?: number;
}
export interface NetworkResult {
  ok: true;
  pincode: string;
  city?: string;
  tier: 1 | 2;
  simulated: true;
  options: NetworkOption[];
  recommended: "fibre" | "airfiber" | "survey";
  message: string;
  backupPossible: boolean;
  fallbackApplied: boolean;
}
export interface NetworkError {
  ok: false;
  error: string;
}

function hash(pin: string): number {
  return parseInt(crypto.createHash("sha256").update("sync" + pin).digest("hex").slice(0, 10), 16);
}

export function checkNetwork(pincode: string, city?: string): NetworkResult | NetworkError {
  const pin = (pincode ?? "").replace(/\D/g, "");
  if (pin.length !== 6 || pin[0] === "0") return { ok: false, error: "Enter a valid 6-digit pincode." };
  const tier = tierForCity(city) ?? 2;
  const h = hash(pin);
  const fibre = (h % 100) / 100 < (tier === 1 ? 0.88 : 0.66);
  const fwa = (Math.floor(h / 256) % 100) / 100 < (tier === 1 ? 0.97 : 0.9);
  const quality = 62 + (Math.floor(h / 65536) % 38);
  const mbps = 55 + (Math.floor(h / 16777216) % 70);
  const options: NetworkOption[] = [
    { key: "fibre", name: "Fibre broadband", productIds: ["P01", "P02"], available: fibre, installDays: product("P01").installDays, speed: "100–300 Mbps", note: fibre ? "Best for steady, heavy use." : "Fibre has not reached this lane yet." },
    { key: "airfiber", name: "5G AirFiber (wireless)", productIds: ["P04"], available: fwa, installDays: product("P04").installDays, speed: `~${mbps} Mbps typical`, signal: quality, note: fwa ? "Plug-and-play. Works where fibre does not." : "5G signal is weak here." },
    { key: "leased", name: "Dedicated leased line", productIds: ["P05", "P06"], available: fibre, installDays: product("P05").installDays, speed: "20–100 Mbps dedicated", note: "Needs a site survey; our field engineer joins a video call." },
  ];
  const recommended = fibre ? "fibre" : fwa ? "airfiber" : "survey";
  const message = {
    fibre: `Good news: fibre is available at your address. Installation takes about ${options[0].installDays} days.`,
    airfiber: `Fibre has not reached your address, so we've switched you to 5G AirFiber. It is live in about ${options[1].installDays} days, with no digging or wiring.`,
    survey: "We can't promise a connection from a distance here. A partner will do a free site survey before you pay anything.",
  }[recommended];
  return { ok: true, pincode: pin, city, tier, simulated: true, options, recommended, message, backupPossible: fibre, fallbackApplied: recommended === "airfiber" };
}

/** Swap a fixed line for 5G AirFiber and drop products whose catalogue rules need a fixed line. */
export function adaptForAirFiber<T extends { productId: string }>(items: T[]): { items: T[]; removed: string[] } {
  const out: T[] = [];
  const removed: string[] = [];
  let swapped = false;
  for (const it of items) {
    if (FIXED_LINES.includes(it.productId)) {
      if (!swapped) {
        out.push({ ...it, productId: "P04" });
        swapped = true;
      }
    } else if (NEEDS_FIXED.includes(it.productId)) removed.push(product(it.productId).name);
    else out.push(it);
  }
  return swapped ? { items: out, removed } : { items, removed: [] };
}
