"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ShopSceneProps } from "./ShopScene";

const ShopScene = dynamic(() => import("./ShopScene"), { ssr: false, loading: () => <ShopPlaceholder /> });

function ShopPlaceholder() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="h-2/3 w-2/3 animate-pulse rounded-[2rem] bg-gradient-to-br from-[#e9f6f4] to-[#fdf3dc]" />
    </div>
  );
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The 3D shop, loaded only in the browser; falls back to a still card without WebGL. */
export function Shop3D(props: ShopSceneProps) {
  const [ok, setOk] = useState<boolean>();
  useEffect(() => setOk(webglAvailable()), []);
  if (ok === undefined) return <div className={props.className}><ShopPlaceholder /></div>;
  if (!ok) return <div className={props.className}><ShopPlaceholder /></div>;
  return <ShopScene {...props} />;
}

/** Short names for what appears on the shop, used in captions. */
export const VISUAL_LABEL: Record<string, string> = {
  P01: "Fibre 100 Mbps", P02: "Fibre 300 Mbps", P03: "Fibre 1 Gbps", P04: "5G AirFiber", P05: "Leased line", P06: "Leased line 100",
  P07: "Business SIMs", P08: "Business SIMs+", P09: "Backup internet", P12: "Cloud phone", P13: "Toll-free number",
  P14: "Bulk SMS", P15: "WhatsApp Business", P16: "Business email", P17: "Cloud backup", P18: "Website",
  P19: "POS & billing", P20: "Device security", P21: "Firewall", P22: "Guest Wi-Fi", P23: "Cloud CCTV", P24: "Machine IoT", P25: "Fleet tracking",
};
