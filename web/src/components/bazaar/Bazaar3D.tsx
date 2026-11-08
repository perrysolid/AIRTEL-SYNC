"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { BazaarSceneProps } from "./BazaarScene";

const BazaarScene = dynamic(() => import("./BazaarScene"), { ssr: false, loading: () => <Placeholder /> });

function Placeholder() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="h-1/2 w-4/5 animate-pulse rounded-[2rem] bg-gradient-to-br from-[#fff0f0] to-[#f4f4f4]" />
    </div>
  );
}

/** The market street, loaded only in the browser; a quiet placeholder without WebGL. */
export function Bazaar3D(props: BazaarSceneProps) {
  const [ok, setOk] = useState<boolean>();
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok ? <BazaarScene {...props} /> : <div className={props.className}><Placeholder /></div>;
}

/** What each shop on the street gets, in the order they connect. */
export const BAZAAR_STEPS = ["Kirana: fibre and UPI billing", "Clinic: business SIMs", "Salon: guest Wi-Fi", "Chai stall: cloud CCTV"];
