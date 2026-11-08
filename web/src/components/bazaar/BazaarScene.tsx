"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Cctv, Pos } from "../shop/ShopScene";

/**
 * A miniature Indian market street on a floating block: a kirana, a clinic, a salon and a chai stall, with an Accel
 * tower at the end of the road. Fibre runs out from the tower to one shop after another; each lights up when it is
 * connected, shows what it got, and starts doing business: a ₹ coin pops at every UPI payment, WhatsApp updates float
 * up from the roofs. A scooter and an auto go by. Then the street goes dark and connects again.
 */

export interface BazaarSceneProps {
  className?: string;
  /** Called when a shop connects (0..3), and with -1 when the street resets. */
  onStep?: (shop: number) => void;
}

const C = {
  ground: "#eeeeee",
  pavement: "#e4ddd2",
  road: "#cdd0d5",
  dash: "#ffffff",
  ink: "#1f1f1f",
  brand: "#e40000",
  marigold: "#f2a900",
  green: "#25d366",
  leaf: "#9cc7a8",
  trunk: "#a47551",
  glassOff: "#3a3b40",
  glassOn: "#ffd98c",
  steel: "#b9bcc3",
};

interface ShopDef {
  x: number;
  w: number;
  h: number;
  body: string;
  awning: string | "stripes";
  sign: string;
  kind: "kirana" | "clinic" | "salon" | "chai";
  badge: "upi" | "sim" | "wifi" | "cctv";
}

export const SHOPS: ShopDef[] = [
  { x: -2.35, w: 1.55, h: 1.55, body: "#f3dfc0", awning: "stripes", sign: C.brand, kind: "kirana", badge: "upi" },
  { x: -0.55, w: 1.45, h: 1.9, body: "#dfeaf3", awning: "#9cc3de", sign: "#ffffff", kind: "clinic", badge: "sim" },
  { x: 1.2, w: 1.4, h: 1.65, body: "#f2cfd3", awning: "#2b2b2f", sign: "#2b2b2f", kind: "salon", badge: "wifi" },
  { x: 2.95, w: 1.5, h: 1.45, body: "#f9dfa0", awning: C.marigold, sign: C.marigold, kind: "chai", badge: "cctv" },
];

const STEP_MS = 1700;
const HOLD_STEPS = 4;
const TOWER = new THREE.Vector3(-4.15, 0, -1.45);
const SHOP_Z = -1.45;
const FRONT = SHOP_Z + 0.71;

/** Seconds since the street last connected shop `i`, or -1 while it is still dark. */
type Clock = { start: number; reduced: boolean };
const sinceConnect = (clock: Clock, t: number, i: number) => {
  if (clock.reduced) return 99;
  const cycle = ((SHOPS.length + 1 + HOLD_STEPS) * STEP_MS) / 1000;
  const local = (t - clock.start) % cycle;
  const at = ((i + 1) * STEP_MS) / 1000;
  return local >= at ? local - at : -1;
};

// ---------------------------------------------------------------------------------------------- small pieces

/** Springs its children in with a little overshoot once `on` turns true. */
function Pop({ on, children, position }: { on: () => boolean; children: ReactNode; position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const st = useRef({ s: 0, v: 0 });
  useFrame((_, frame) => {
    const dt = Math.min(frame, 1 / 30); // a long frame would blow up the explicit spring
    const s = st.current;
    s.v += ((on() ? 1 : 0) - s.s) * 160 * dt;
    s.v *= Math.pow(0.002, dt);
    s.s += s.v * dt;
    ref.current?.scale.setScalar(Math.max(0.0001, s.s));
  });
  return (
    <group ref={ref} position={position} scale={0.0001}>
      {children}
    </group>
  );
}

function Tree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />
        <meshStandardMaterial color={C.trunk} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.38, 20, 16]} />
        <meshStandardMaterial color={C.leaf} roughness={0.85} />
      </mesh>
      <mesh position={[0.18, 0.55, 0.12]} castShadow>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color="#8dbb9a" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Tower({ clock }: { clock: Clock }) {
  const tip = useRef<THREE.MeshStandardMaterial>(null);
  const rings = useRef<THREE.Group>(null);
  useFrame(({ clock: c }) => {
    const t = c.getElapsedTime();
    if (tip.current) tip.current.emissiveIntensity = 0.6 + 0.6 * Math.max(0, Math.sin(t * 3));
    rings.current?.children.forEach((m, i) => {
      const k = ((t * 0.55 + i / 3) % 1);
      m.scale.setScalar(0.3 + k * 1.6);
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * (sinceConnect(clock, t, 0) >= 0 ? 0.45 : 0.15);
    });
  });
  return (
    <group position={TOWER.toArray()}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.48, 0.12, 6]} />
        <meshStandardMaterial color="#e6e6e6" />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.13, 3.2, 10]} />
        <meshStandardMaterial color={C.steel} metalness={0.5} roughness={0.35} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 0.14, 2.75, Math.sin((i * Math.PI * 2) / 3) * 0.14]} rotation={[0, -(i * Math.PI * 2) / 3, 0]} castShadow>
          <boxGeometry args={[0.05, 0.42, 0.12]} />
          <meshStandardMaterial color="#f4f4f4" />
        </mesh>
      ))}
      <mesh position={[0, 3.3, 0]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial ref={tip} color={C.brand} emissive={C.brand} emissiveIntensity={1} />
      </mesh>
      <group ref={rings} position={[0, 2.8, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.012, 6, 48]} />
            <meshBasicMaterial color={C.brand} transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** The fibre to one shop: drawn out from the tower when the shop connects, then light pulses run along it. */
function Fibre({ i, clock }: { i: number; clock: Clock }) {
  const s = SHOPS[i];
  // laid like real cable: out of the tower, one shared run along the pavement, then a short turn into the shop
  const curve = useMemo(() => {
    const y = 0.075;
    const pts = [
      new THREE.Vector3(TOWER.x + 0.3, y, TOWER.z + 0.25),
      new THREE.Vector3(TOWER.x + 0.3, y, FRONT + 0.34),
      new THREE.Vector3(s.x - 0.25, y, FRONT + 0.34),
      new THREE.Vector3(s.x - 0.25, y, FRONT + 0.05),
    ];
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let k = 1; k < pts.length; k++) path.add(new THREE.LineCurve3(pts[k - 1], pts[k]));
    return path;
  }, [s.x]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve as unknown as THREE.Curve<THREE.Vector3>, 160, 0.032, 8, false), [curve]);
  const pulses = useRef<THREE.Group>(null);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock: c }) => {
    const t = c.getElapsedTime();
    const since = sinceConnect(clock, t, i);
    const p = since < 0 ? 0 : Math.min(1, since / 0.9);
    const ring = 8 * 6; // indices per tube segment
    geo.setDrawRange(0, Math.floor((geo.index!.count / ring) * p) * ring);
    pulses.current?.children.forEach((m, k) => {
      m.visible = p >= 1;
      if (p >= 1) m.position.copy(curve.getPointAt((t * 0.45 + k / 3) % 1));
    });
  });
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={C.brand} emissive={C.brand} emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      <group ref={pulses}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} visible={false}>
            <sphereGeometry args={[0.045, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Awning({ s }: { s: ShopDef }) {
  const y = s.h * 0.66;
  const width = s.w * 0.86;
  if (s.awning === "stripes") {
    const n = 7;
    return (
      <group position={[s.x, y, FRONT + 0.17]} rotation={[0.42, 0, 0]}>
        {Array.from({ length: n }, (_, k) => (
          <mesh key={k} position={[-width / 2 + (width / n) * (k + 0.5), 0, 0]} castShadow>
            <boxGeometry args={[width / n, 0.03, 0.42]} />
            <meshStandardMaterial color={k % 2 ? "#ffffff" : C.brand} roughness={0.6} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <mesh position={[s.x, y, FRONT + 0.17]} rotation={[0.42, 0, 0]} castShadow>
      <boxGeometry args={[width, 0.03, 0.42]} />
      <meshStandardMaterial color={s.awning} roughness={0.6} />
    </mesh>
  );
}

/** What the sign shows: crates for the kirana, a cross for the clinic, a mirror for the salon, a cup for the chai stall. */
function SignIcon({ kind }: { kind: ShopDef["kind"] }) {
  if (kind === "clinic")
    return (
      <group>
        <mesh><boxGeometry args={[0.2, 0.06, 0.02]} /><meshStandardMaterial color={C.brand} /></mesh>
        <mesh><boxGeometry args={[0.06, 0.2, 0.02]} /><meshStandardMaterial color={C.brand} /></mesh>
      </group>
    );
  if (kind === "salon")
    return (
      <mesh>
        <torusGeometry args={[0.07, 0.018, 8, 24]} />
        <meshStandardMaterial color="#f3c9c9" />
      </mesh>
    );
  if (kind === "chai")
    return (
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.055, 0.03, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    );
  return (
    <group>
      {[-0.1, 0, 0.1].map((x) => (
        <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.07, 0.07, 0.02]} /><meshStandardMaterial color="#ffffff" /></mesh>
      ))}
    </group>
  );
}

/** The thing each shop got, on a small white tile above its roof. */
function Badge({ kind }: { kind: ShopDef["badge"] }) {
  const tile = (
    <RoundedBox args={[0.46, 0.46, 0.08]} radius={0.08} smoothness={4} castShadow>
      <meshStandardMaterial color="#ffffff" roughness={0.35} />
    </RoundedBox>
  );
  let icon: ReactNode;
  if (kind === "upi")
    icon = (
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.04, 28]} />
        <meshStandardMaterial color={C.marigold} metalness={0.4} roughness={0.3} />
      </mesh>
    );
  else if (kind === "wifi")
    icon = (
      <group position={[0, -0.09, 0]}>
        {[0.06, 0.12, 0.18].map((r) => (
          <mesh key={r} rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[r, 0.018, 6, 24, Math.PI / 2]} />
            <meshStandardMaterial color={C.brand} />
          </mesh>
        ))}
        <mesh><sphereGeometry args={[0.025, 10, 8]} /><meshStandardMaterial color={C.brand} /></mesh>
      </group>
    );
  else if (kind === "sim")
    icon = (
      <group>
        <mesh><boxGeometry args={[0.18, 0.24, 0.03]} /><meshStandardMaterial color={C.brand} /></mesh>
        <mesh position={[0, -0.02, 0.02]}><boxGeometry args={[0.09, 0.08, 0.01]} /><meshStandardMaterial color={C.marigold} metalness={0.5} roughness={0.3} /></mesh>
      </group>
    );
  else
    icon = (
      <group>
        <mesh><boxGeometry args={[0.22, 0.12, 0.1]} /><meshStandardMaterial color={C.ink} /></mesh>
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.06, 16]} /><meshStandardMaterial color="#555" /></mesh>
        <mesh position={[-0.08, 0.04, 0.051]}><sphereGeometry args={[0.015, 8, 8]} /><meshBasicMaterial color={C.brand} /></mesh>
      </group>
    );
  return (
    <group>
      {tile}
      <group position={[0, 0, 0.07]}>{icon}</group>
    </group>
  );
}

/** A UPI payment: a coin jumps off the counter and a ring spreads out, every couple of seconds. */
function PaymentBeep({ s, clock }: { s: ShopDef; clock: Clock }) {
  const coin = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock: c }) => {
    const since = sinceConnect(clock, c.getElapsedTime(), 0);
    const k = since < 1 ? -1 : ((since - 1) % 2.2) / 2.2;
    const show = k >= 0 && k < 0.6;
    if (coin.current) {
      coin.current.visible = show;
      const q = Math.min(1, k / 0.6);
      coin.current.position.y = 0.75 + Math.sin(q * Math.PI) * 0.55;
      coin.current.rotation.y = q * Math.PI * 4;
    }
    if (ring.current) {
      ring.current.visible = show;
      ring.current.scale.setScalar(0.2 + Math.min(1, k / 0.6) * 1.4);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - Math.min(1, k / 0.6));
    }
  });
  return (
    <group position={[s.x, 0, FRONT + 0.25]}>
      <group ref={coin} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.035, 28]} />
          <meshStandardMaterial color={C.marigold} metalness={0.55} roughness={0.25} emissive={C.marigold} emissiveIntensity={0.2} />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, 0.78, 0]} visible={false}>
        <torusGeometry args={[0.2, 0.012, 6, 40]} />
        <meshBasicMaterial color={C.marigold} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A WhatsApp update rising from a connected shop's roof and fading away. */
function Updates({ i, s, clock }: { i: number; s: ShopDef; clock: Clock }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(({ clock: c }) => {
    const since = sinceConnect(clock, c.getElapsedTime(), i);
    const period = 3.1 + i * 0.4;
    const k = since < 0.6 ? -1 : ((since - 0.6 + i * 0.7) % period) / period;
    if (!group.current) return;
    group.current.visible = k >= 0 && k < 0.55;
    const q = Math.max(0, k) / 0.55;
    group.current.position.y = s.h + 1.05 + q * 0.7;
    for (const m of mats.current) m.opacity = q < 0.15 ? q / 0.15 : 1 - Math.max(0, q - 0.55) / 0.45;
  });
  return (
    <group ref={group} position={[s.x + 0.38, s.h + 1.05, SHOP_Z + 0.2]} visible={false}>
      <RoundedBox args={[0.34, 0.22, 0.05]} radius={0.06} smoothness={3}>
        <meshStandardMaterial ref={(m) => { if (m) mats.current[0] = m; }} color={C.green} transparent />
      </RoundedBox>
      <mesh position={[-0.12, -0.13, 0]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.07, 0.07, 0.05]} />
        <meshStandardMaterial ref={(m) => { if (m) mats.current[1] = m; }} color={C.green} transparent />
      </mesh>
      {[-0.08, 0, 0.08].map((x, k) => (
        <mesh key={x} position={[x, 0, 0.03]}>
          <sphereGeometry args={[0.022, 8, 6]} />
          <meshStandardMaterial ref={(m) => { if (m) mats.current[2 + k] = m; }} color="#ffffff" transparent />
        </mesh>
      ))}
    </group>
  );
}

function Shop({ i, clock }: { i: number; clock: Clock }) {
  const s = SHOPS[i];
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const off = useMemo(() => new THREE.Color(C.glassOff), []);
  const on = useMemo(() => new THREE.Color(C.glassOn), []);
  const t = useRef(0);
  useFrame(({ clock: c }, dt) => {
    const lit = sinceConnect(clock, c.getElapsedTime(), i) >= 0.7;
    t.current += ((lit ? 1 : 0) - t.current) * Math.min(1, dt * 4);
    if (glass.current) {
      glass.current.color.copy(off).lerp(on, t.current);
      glass.current.emissive.copy(on);
      glass.current.emissiveIntensity = t.current * 0.55;
    }
  });
  const isOn = () => sinceConnect(clock, performance.now() / 1000 - clockOffset, i) >= 0.7;
  return (
    <group>
      <RoundedBox args={[s.w, s.h, 1.4]} radius={0.05} smoothness={3} position={[s.x, s.h / 2, SHOP_Z]} castShadow receiveShadow>
        <meshStandardMaterial color={s.body} roughness={0.8} />
      </RoundedBox>
      {/* parapet */}
      <mesh position={[s.x, s.h + 0.04, SHOP_Z]} castShadow>
        <boxGeometry args={[s.w + 0.06, 0.08, 1.46]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {/* shop opening: dark until the shop is connected, then warm light */}
      <mesh position={[s.x, s.h * 0.34, FRONT + 0.005]}>
        <boxGeometry args={[s.w * 0.74, s.h * 0.5, 0.02]} />
        <meshStandardMaterial ref={glass} color={C.glassOff} roughness={0.3} />
      </mesh>
      {/* counter */}
      <mesh position={[s.x, 0.22, FRONT + 0.12]} castShadow receiveShadow>
        <boxGeometry args={[s.w * 0.74, 0.44, 0.22]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      <mesh position={[s.x, 0.45, FRONT + 0.12]}>
        <boxGeometry args={[s.w * 0.76, 0.03, 0.26]} />
        <meshStandardMaterial color={C.trunk} roughness={0.7} />
      </mesh>
      <Awning s={s} />
      {/* sign board */}
      <mesh position={[s.x, s.h - 0.2, FRONT + 0.02]} castShadow>
        <boxGeometry args={[s.w * 0.66, 0.26, 0.04]} />
        <meshStandardMaterial color={s.sign} roughness={0.5} />
      </mesh>
      <group position={[s.x, s.h - 0.2, FRONT + 0.05]}>
        <SignIcon kind={s.kind} />
      </group>
      <Pop on={isOn} position={[s.x, s.h + 0.55, SHOP_Z + 0.25]}>
        <Badge kind={s.badge} />
      </Pop>
      {/* every shop bills on a POS once it's connected; the kirana and the chai stall also get a camera */}
      <Pop on={isOn} position={[s.x + s.w * 0.18, 0.47, FRONT + 0.12]}>
        <group scale={0.55}>
          <Pos />
        </group>
      </Pop>
      {(s.kind === "kirana" || s.kind === "chai") && (
        <Pop on={isOn} position={[s.x - s.w / 2 + 0.06, s.h * 0.78, FRONT + 0.05]}>
          <group scale={0.55}>
            <Cctv />
          </group>
        </Pop>
      )}
      <Updates i={i} s={s} clock={clock} />
    </group>
  );
}

/** Pop reads the clock outside a frame callback, so it needs the same time base as three's clock. */
let clockOffset = 0;

/** A scooter and an auto going up and down the road. */
function Traffic() {
  const scooter = useRef<THREE.Group>(null);
  const auto = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (scooter.current) scooter.current.position.x = -5.2 + ((t * 0.9) % 10.4);
    if (auto.current) auto.current.position.x = 5.2 - ((t * 0.6 + 4) % 10.4);
  });
  const wheel = (x: number, z: number, r = 0.07) => (
    <mesh position={[x, r, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, 0.04, 16]} />
      <meshStandardMaterial color={C.ink} />
    </mesh>
  );
  return (
    <group>
      <group ref={scooter} position={[0, 0.02, 0.62]}>
        {wheel(-0.17, 0)}
        {wheel(0.17, 0)}
        <mesh position={[0, 0.16, 0]} castShadow><boxGeometry args={[0.36, 0.1, 0.12]} /><meshStandardMaterial color={C.brand} /></mesh>
        <mesh position={[0.17, 0.27, 0]} castShadow><boxGeometry args={[0.05, 0.2, 0.05]} /><meshStandardMaterial color="#d8d8d8" /></mesh>
        <mesh position={[-0.02, 0.36, 0]} castShadow><capsuleGeometry args={[0.06, 0.14, 4, 8]} /><meshStandardMaterial color="#4a6fa5" /></mesh>
        <mesh position={[0, 0.53, 0]} castShadow><sphereGeometry args={[0.065, 12, 10]} /><meshStandardMaterial color={C.ink} /></mesh>
        {/* delivery box */}
        <mesh position={[-0.2, 0.29, 0]} castShadow><boxGeometry args={[0.14, 0.14, 0.14]} /><meshStandardMaterial color={C.marigold} /></mesh>
      </group>
      <group ref={auto} position={[0, 0.02, 1.08]} rotation={[0, Math.PI, 0]}>
        {wheel(-0.2, -0.1, 0.075)}
        {wheel(-0.2, 0.1, 0.075)}
        {wheel(0.22, 0, 0.075)}
        <RoundedBox args={[0.52, 0.28, 0.3]} radius={0.05} smoothness={3} position={[0, 0.25, 0]} castShadow>
          <meshStandardMaterial color="#3fae5a" />
        </RoundedBox>
        <RoundedBox args={[0.5, 0.06, 0.32]} radius={0.03} smoothness={3} position={[-0.02, 0.5, 0]} castShadow>
          <meshStandardMaterial color={C.ink} />
        </RoundedBox>
        <mesh position={[0.24, 0.42, 0]}><boxGeometry args={[0.02, 0.16, 0.26]} /><meshStandardMaterial color="#cfe6f5" transparent opacity={0.7} /></mesh>
        <mesh position={[-0.02, 0.36, 0]}><boxGeometry args={[0.46, 0.2, 0.28]} /><meshStandardMaterial color={C.marigold} /></mesh>
      </group>
    </group>
  );
}

function Ground() {
  return (
    <group>
      <RoundedBox args={[10.4, 0.5, 4.3]} radius={0.22} smoothness={4} position={[0, -0.25, -0.45]} receiveShadow>
        <meshStandardMaterial color={C.ground} roughness={0.95} />
      </RoundedBox>
      {/* pavement in front of the shops */}
      <mesh position={[0, 0.02, FRONT + 0.32]} receiveShadow>
        <boxGeometry args={[10, 0.04, 0.62]} />
        <meshStandardMaterial color={C.pavement} roughness={0.95} />
      </mesh>
      {/* road with lane dashes */}
      <mesh position={[0, 0.005, 0.85]} receiveShadow>
        <boxGeometry args={[10.2, 0.01, 1.05]} />
        <meshStandardMaterial color={C.road} roughness={1} />
      </mesh>
      {Array.from({ length: 13 }, (_, k) => (
        <mesh key={k} position={[-4.8 + k * 0.8, 0.012, 0.85]}>
          <boxGeometry args={[0.36, 0.005, 0.04]} />
          <meshStandardMaterial color={C.dash} />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ clock, onStep }: { clock: Clock; onStep?: (i: number) => void }) {
  const { camera, size } = useThree();
  const world = useRef<THREE.Group>(null);
  const last = useRef(-2);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const cam = camera as THREE.PerspectiveCamera;
    const v = THREE.MathUtils.degToRad(cam.fov) / 2;
    const h = Math.atan(Math.tan(v) * aspect);
    // the block is about 11 wide and reads about 5 tall from this angle; keep a little air around it
    const dist = Math.max(5.6 / Math.tan(h), 2.7 / Math.tan(v)) * 1.03;
    camera.position.copy(new THREE.Vector3(0.38, 0.5, 1).normalize().multiplyScalar(dist));
    camera.lookAt(0.1, 0.75, -0.5);
  }, [camera, size]);
  useFrame(({ pointer, clock: c }) => {
    const t = c.getElapsedTime();
    clockOffset = performance.now() / 1000 - t;
    if (world.current) {
      world.current.rotation.y += (pointer.x * 0.12 + Math.sin(t * 0.15) * 0.05 - world.current.rotation.y) * 0.04;
      world.current.rotation.x += (-pointer.y * 0.04 - world.current.rotation.x) * 0.04;
    }
    let step = -1;
    for (let i = 0; i < SHOPS.length; i++) if (sinceConnect(clock, t, i) >= 0) step = i;
    if (step !== last.current) {
      last.current = step;
      onStep?.(step);
    }
  });
  return (
    <group ref={world}>
      <Ground />
      <Tower clock={clock} />
      {SHOPS.map((_, i) => (
        <group key={i}>
          <Fibre i={i} clock={clock} />
          <Shop i={i} clock={clock} />
        </group>
      ))}
      <PaymentBeep s={SHOPS[0]} clock={clock} />
      <Traffic />
      <Tree position={[4.55, 0, -1.6]} />
      <Tree position={[-3.4, 0, 1.45]} s={0.7} />
      <Tree position={[4.45, 0, 1.45]} s={0.65} />
    </group>
  );
}

export default function BazaarScene({ className, onStep }: BazaarSceneProps) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const clock = useMemo<Clock>(() => ({ start: 0, reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches }), []);
  // Only render while on screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className={className} aria-hidden>
      <Canvas shadows dpr={[1, 2]} frameloop={visible ? "always" : "never"} camera={{ fov: 26, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }} resize={{ scroll: false }}>
        <hemisphereLight args={["#ffffff", "#d9d2c8", 0.85]} />
        <directionalLight position={[6, 10, 7]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0004} />
        <directionalLight position={[-6, 4, -3]} intensity={0.5} color="#ffe8e8" />
        <Rig clock={clock} onStep={onStep} />
        <ContactShadows position={[0, -0.52, -0.45]} opacity={0.32} scale={16} blur={3} far={3} />
      </Canvas>
    </div>
  );
}
