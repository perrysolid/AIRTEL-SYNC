"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

/**
 * A low-poly Indian shopfront that "gets connected": each product in the
 * owner's plan appears on the shop as a physical thing (router + fibre from
 * the tower, CCTV on the wall, POS on the counter, Wi-Fi rings, a cloud for
 * email/backup...). Used on the landing hero, advisor, quote and tracker.
 */

export interface ShopSceneProps {
  /** Catalogue ids in the plan (P01..P25). */
  items: string[];
  /** When given (tracker), these items are live; the rest show as installing. */
  live?: string[];
  className?: string;
  /** Red rim light for dark backgrounds (landing hero). */
  glow?: boolean;
}

const C = {
  plinth: "#e7eaf3",
  floor: "#f4ead8",
  wall: "#f3f0ea",
  wallSide: "#e6e1d8",
  wood: "#c48a52",
  counter: "#ffffff",
  ink: "#161a33",
  marigold: "#ffb400",
  brand: "#e4002b",
  signal: "#12a39a",
  coral: "#e5484d",
  white: "#ffffff",
  device: "#f7f8fc",
  green: "#25d366",
};

const FIBRE = ["P01", "P02", "P03"];

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

/** Springs a prop in (with a little overshoot) when it joins the plan, out when removed. */
function Pop({ show, children, position, delay = 0 }: { show: boolean; children: ReactNode; position: [number, number, number]; delay?: number }) {
  const ref = useRef<THREE.Group>(null);
  const state = useRef({ s: 0, v: 0, t: 0 });
  useFrame((_, dt) => {
    const st = state.current;
    st.t = show ? st.t + dt : 0;
    const target = show && st.t > delay ? 1 : 0;
    // Critically-underdamped spring for a friendly bounce.
    st.v += (target - st.s) * 180 * dt;
    st.v *= Math.pow(0.0009, dt);
    st.s += st.v * dt;
    if (ref.current) {
      const s = Math.max(0, st.s);
      ref.current.scale.setScalar(s);
      ref.current.visible = s > 0.01;
    }
  });
  return (
    <group ref={ref} position={position} scale={0}>
      {children}
    </group>
  );
}

function Bob({ children, speed = 1.2, amp = 0.08 }: { children: ReactNode; speed?: number; amp?: number }) {
  const ref = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = Math.sin(clock.elapsedTime * speed + phase) * amp;
  });
  return <group ref={ref}>{children}</group>;
}

/** Status ring under a device on the tracker: pulsing marigold while installing, solid teal when live. */
function StatusRing({ live }: { live?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || live) return;
    const k = 1 + (Math.sin(clock.elapsedTime * 4) + 1) * 0.12;
    ref.current.scale.set(k, k, k);
  });
  if (live === undefined) return null;
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={-0.02}>
      <ringGeometry args={[0.32, 0.4, 40]} />
      <meshBasicMaterial color={live ? C.signal : C.marigold} transparent opacity={0.9} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// The shop
// ---------------------------------------------------------------------------

function Shop() {
  const packets = useMemo(() => {
    const colors = ["#f2a900", "#e5484d", "#12a39a", "#5b6cff", "#ff8a3d", "#ffffff", "#9b5de5", "#2ec4b6"];
    const out: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    let k = 0;
    for (const y of [0.74, 1.24, 1.74]) {
      let x = -1.85;
      while (x < -0.05) {
        const w = 0.16 + ((k * 37) % 7) * 0.025;
        const h = 0.18 + ((k * 53) % 5) * 0.04;
        out.push({ p: [x + w / 2, y + h / 2, -1.3], s: [w, h, 0.22], c: colors[k % colors.length] });
        x += w + 0.04;
        k++;
      }
    }
    return out;
  }, []);

  return (
    <group>
      {/* plinth + floor */}
      <RoundedBox args={[4.8, 0.32, 3.8]} radius={0.08} position={[0, -0.16, 0]} receiveShadow>
        <meshStandardMaterial color={C.plinth} roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.011, 0]} receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4.3, 3.3]} />
        <meshStandardMaterial color={C.floor} roughness={0.95} />
      </mesh>
      {/* walls */}
      <mesh position={[0, 1.3, -1.58]} castShadow receiveShadow>
        <boxGeometry args={[4.3, 2.6, 0.14]} />
        <meshStandardMaterial color={C.wall} roughness={0.85} />
      </mesh>
      <mesh position={[-2.08, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.14, 2.6, 3.3]} />
        <meshStandardMaterial color={C.wallSide} roughness={0.85} />
      </mesh>
      {/* sign board with the Accel mark */}
      <group position={[0.25, 3.12, -1.49]}>
        <RoundedBox args={[1.9, 0.48, 0.06]} radius={0.04} castShadow>
          <meshStandardMaterial color={C.ink} roughness={0.5} />
        </RoundedBox>
        <mesh position={[-0.62, 0, 0.04]} rotation-z={0}>
          <coneGeometry args={[0.15, 0.26, 3]} />
          <meshStandardMaterial color={C.brand} roughness={0.4} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.2 + i * 0.36, 0, 0.04]}>
            <boxGeometry args={[0.28, 0.07, 0.01]} />
            <meshStandardMaterial color={i === 0 ? C.brand : "#c9cde0"} />
          </mesh>
        ))}
      </group>
      {/* striped awning along the top of the back wall */}
      <group position={[0, 2.66, -1.2]} rotation-x={0.5}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-2.15 + i * 0.48 + 0.24, 0, 0]} castShadow>
            <boxGeometry args={[0.48, 0.05, 0.62]} />
            <meshStandardMaterial color={i % 2 ? C.white : C.brand} roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* shelves with goods */}
      {[0.72, 1.22, 1.72].map((y) => (
        <mesh key={y} position={[-0.95, y, -1.32]} castShadow receiveShadow>
          <boxGeometry args={[1.95, 0.05, 0.42]} />
          <meshStandardMaterial color={C.wood} roughness={0.8} />
        </mesh>
      ))}
      {packets.map((b, i) => (
        <mesh key={i} position={b.p} castShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={b.c} roughness={0.6} />
        </mesh>
      ))}
      {/* counter */}
      <group position={[0.55, 0, 0.55]}>
        <RoundedBox args={[2.3, 0.92, 0.72]} radius={0.05} position={[0, 0.46, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={C.counter} roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, 0.5, 0.365]}>
          <boxGeometry args={[2.2, 0.12, 0.01]} />
          <meshStandardMaterial color={C.brand} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.42, 0.06, 0.82]} />
          <meshStandardMaterial color={C.wood} roughness={0.7} />
        </mesh>
      </group>
      {/* sacks of grain by the counter */}
      {[
        [-1.55, 0.26, 0.9],
        [-1.15, 0.22, 1.15],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <sphereGeometry args={[0.26 - i * 0.04, 16, 12]} />
          <meshStandardMaterial color="#e3c79a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Tower() {
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.emissiveIntensity = (Math.sin(clock.elapsedTime * 3) + 1) * 1.2;
  });
  return (
    <group position={[3.35, 0, -1.3]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 6]} />
        <meshStandardMaterial color={C.plinth} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.16, 3.3, 6]} />
        <meshStandardMaterial color="#9aa1bd" metalness={0.3} roughness={0.5} />
      </mesh>
      {[2.6, 3.0].map((y, i) => (
        <group key={y} position={[0, y, 0]} rotation-y={i * 0.6}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[Math.cos((k * 2 * Math.PI) / 3) * 0.17, 0, Math.sin((k * 2 * Math.PI) / 3) * 0.17]} castShadow>
              <boxGeometry args={[0.07, 0.36, 0.12]} />
              <meshStandardMaterial color={C.white} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 3.42, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial ref={beacon} color={C.coral} emissive={C.coral} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

/** Light pulses running along a path: data arriving at the shop. */
function Pulses({ curve, color, count = 3, speed = 0.35, size = 0.06 }: { curve: THREE.Curve<THREE.Vector3>; color: string; count?: number; speed?: number; size?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * speed + i / count) % 1;
      m.position.copy(curve.getPointAt(t));
    });
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)}>
          <sphereGeometry args={[size, 12, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function FibreLine({ show }: { show: boolean }) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(3.35, 0.06, -1.3), new THREE.Vector3(2.4, 0.06, -1.42), new THREE.Vector3(1.9, 0.08, -1.46), new THREE.Vector3(1.75, 0.7, -1.47), new THREE.Vector3(1.45, 1.28, -1.47)]),
    [],
  );
  if (!show) return null;
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 48, 0.025, 8, false]} />
        <meshStandardMaterial color={C.marigold} roughness={0.4} />
      </mesh>
      <Pulses curve={curve} color="#fff3c4" />
    </group>
  );
}

function AirWaves({ show }: { show: boolean }) {
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(3.35, 3.2, -1.3), new THREE.Vector3(2.5, 3.9, -1.4), new THREE.Vector3(1.55, 2.95, -1.45)), []);
  if (!show) return null;
  return <Pulses curve={curve} color={C.signal} count={4} speed={0.5} size={0.07} />;
}

function Router({ backup }: { backup?: boolean }) {
  return (
    <group>
      <RoundedBox args={[0.5, 0.12, 0.3]} radius={0.03} castShadow>
        <meshStandardMaterial color={C.device} roughness={0.4} />
      </RoundedBox>
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.2, -0.08]} rotation-z={x > 0 ? -0.2 : 0.2}>
          <cylinderGeometry args={[0.015, 0.02, 0.32, 6]} />
          <meshStandardMaterial color={C.ink} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.12 + i * 0.08, 0.02, 0.152]}>
          <boxGeometry args={[0.03, 0.02, 0.01]} />
          <meshBasicMaterial color={backup ? C.marigold : C.signal} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function WifiRings() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.6 + i / 3) % 1;
      m.scale.setScalar(0.4 + t * 1.4);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - t);
    });
  });
  return (
    <group rotation-y={Math.PI / 4}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} rotation-z={Math.PI / 4}>
          <torusGeometry args={[0.5, 0.025, 8, 32, Math.PI / 2]} />
          <meshBasicMaterial color={C.signal} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Phone({ tilt = 0 }: { tilt?: number }) {
  return (
    <group rotation={[-0.35, tilt, 0]}>
      <RoundedBox args={[0.18, 0.34, 0.025]} radius={0.02} castShadow>
        <meshStandardMaterial color={C.ink} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0, 0.014]}>
        <planeGeometry args={[0.15, 0.29]} />
        <meshStandardMaterial color="#7fd8ff" emissive="#4cc9ff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function Pos() {
  return (
    <group>
      <group rotation-x={-0.6} position={[0, 0.16, 0]}>
        <RoundedBox args={[0.5, 0.36, 0.03]} radius={0.02} castShadow>
          <meshStandardMaterial color={C.ink} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.44, 0.3]} />
          <meshStandardMaterial color="#ffffff" emissive={C.marigold} emissiveIntensity={0.25} />
        </mesh>
      </group>
      <mesh position={[0, 0.03, 0.05]}>
        <boxGeometry args={[0.12, 0.06, 0.12]} />
        <meshStandardMaterial color={C.ink} />
      </mesh>
      <RoundedBox args={[0.14, 0.04, 0.22]} radius={0.015} position={[0.38, 0.02, 0.05]} castShadow>
        <meshStandardMaterial color="#2b3050" />
      </RoundedBox>
    </group>
  );
}

function Cctv() {
  const ref = useRef<THREE.Group>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = 0.9 + Math.sin(clock.elapsedTime * 0.7) * 0.5;
    if (led.current) led.current.opacity = Math.sin(clock.elapsedTime * 5) > 0 ? 1 : 0.15;
  });
  return (
    <group>
      <mesh position={[-0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.06, 0.06]} />
        <meshStandardMaterial color="#d4d8e6" />
      </mesh>
      <group ref={ref} rotation-z={-0.35}>
        <RoundedBox args={[0.42, 0.16, 0.18]} radius={0.04} position={[0.2, 0, 0]} castShadow>
          <meshStandardMaterial color={C.white} roughness={0.35} />
        </RoundedBox>
        <mesh position={[0.43, 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshStandardMaterial color={C.ink} roughness={0.2} />
        </mesh>
        <mesh position={[0.3, 0.085, 0.04]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial ref={led} color={C.coral} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Cloud({ extras }: { extras: string[] }) {
  return (
    <group>
      {[
        [0, 0, 0, 0.36],
        [0.36, -0.06, 0, 0.28],
        [-0.36, -0.08, 0, 0.26],
        [0.12, 0.2, 0, 0.27],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 20, 16]} />
          <meshStandardMaterial color={C.white} roughness={0.9} />
        </mesh>
      ))}
      {extras.map((c, i) => (
        <mesh key={i} position={[-0.3 + i * 0.3, -0.42, 0.1]}>
          <boxGeometry args={[0.16, 0.12, 0.02]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function ChatBubble() {
  return (
    <group>
      <RoundedBox args={[0.7, 0.46, 0.14]} radius={0.12} castShadow>
        <meshStandardMaterial color={C.green} roughness={0.5} />
      </RoundedBox>
      <mesh position={[-0.22, -0.28, 0]} rotation-z={0.6}>
        <coneGeometry args={[0.08, 0.18, 3]} />
        <meshStandardMaterial color={C.green} />
      </mesh>
      {[-0.16, 0, 0.16].map((x) => (
        <mesh key={x} position={[x, 0, 0.075]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={C.white} />
        </mesh>
      ))}
    </group>
  );
}

function Shield() {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.32);
    s.quadraticCurveTo(0.2, 0.3, 0.28, 0.24);
    s.lineTo(0.26, 0);
    s.quadraticCurveTo(0.22, -0.22, 0, -0.34);
    s.quadraticCurveTo(-0.22, -0.22, -0.26, 0);
    s.lineTo(-0.28, 0.24);
    s.quadraticCurveTo(-0.2, 0.3, 0, 0.32);
    return s;
  }, []);
  return (
    <group>
      <mesh castShadow position-z={-0.04}>
        <extrudeGeometry args={[shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }]} />
        <meshStandardMaterial color={C.signal} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.02, 0.07]} rotation-z={-Math.PI / 4}>
        <boxGeometry args={[0.07, 0.2, 0.02]} />
        <meshStandardMaterial color={C.white} />
      </mesh>
      <mesh position={[-0.07, -0.02, 0.07]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.07, 0.12, 0.02]} />
        <meshStandardMaterial color={C.white} />
      </mesh>
    </group>
  );
}

function Rack() {
  const leds = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    leds.current.forEach((m, i) => {
      if (m) m.opacity = Math.sin(clock.elapsedTime * (4 + i) + i) > 0.2 ? 1 : 0.2;
    });
  });
  return (
    <group>
      <RoundedBox args={[0.55, 1.1, 0.5]} radius={0.03} position-y={0.55} castShadow>
        <meshStandardMaterial color="#2b3050" roughness={0.4} />
      </RoundedBox>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 0.25 + i * 0.18, 0.252]}>
          <boxGeometry args={[0.44, 0.1, 0.01]} />
          <meshStandardMaterial color="#3a4066" />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0.16, 0.25 + i * 0.18, 0.26]}>
          <boxGeometry args={[0.04, 0.03, 0.01]} />
          <meshBasicMaterial ref={(m) => void (leds.current[i] = m)} color={i % 2 ? C.signal : C.marigold} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function IotSensor() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.elapsedTime * 0.8) % 1;
    ring.current.scale.setScalar(1 + t * 2.2);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
  });
  return (
    <group>
      <RoundedBox args={[0.7, 0.5, 0.5]} radius={0.05} position-y={0.25} castShadow>
        <meshStandardMaterial color="#8a93b8" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      <mesh position={[0.15, 0.34, 0.26]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 20]} />
        <meshStandardMaterial color="#c9cde0" />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.06, 20]} />
        <meshStandardMaterial color={C.signal} />
      </mesh>
      <mesh ref={ring} position={[0, 0.56, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.1, 0.13, 32]} />
        <meshBasicMaterial color={C.signal} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Scooter() {
  return (
    <group rotation-y={-0.5}>
      <RoundedBox args={[0.9, 0.5, 0.5]} radius={0.08} position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color={C.marigold} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.32, 0.34, 0.46]} radius={0.06} position={[0.58, 0.34, 0]} castShadow>
        <meshStandardMaterial color={C.ink} roughness={0.5} />
      </RoundedBox>
      {[
        [-0.28, 0.14, 0.25],
        [-0.28, 0.14, -0.25],
        [0.52, 0.14, 0.25],
        [0.52, 0.14, -0.25],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.08, 16]} />
          <meshStandardMaterial color="#2b3050" />
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0]}>
        <coneGeometry args={[0.08, 0.18, 12]} />
        <meshStandardMaterial color={C.coral} />
      </mesh>
    </group>
  );
}

function Devices({ items, live }: { items: Set<string>; live?: Set<string> }) {
  const has = (...ids: string[]) => ids.some((id) => items.has(id));
  const isLive = (...ids: string[]) => (live ? ids.some((id) => live.has(id) && items.has(id)) : undefined);
  const fibre = has(...FIBRE);
  const cloudExtras = [has("P16") && "#5b6cff", has("P17") && C.signal, has("P18") && C.marigold].filter(Boolean) as string[];

  return (
    <group>
      <FibreLine show={fibre} />
      <AirWaves show={has("P04")} />
      <Pop show={fibre || has("P04", "P05", "P06")} position={[1.42, 1.32, -1.38]}>
        <Router />
        <StatusRing live={isLive(...FIBRE, "P04", "P05", "P06")} />
      </Pop>
      <Pop show={has("P04")} position={[1.55, 2.78, -1.4]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.36, 20]} />
          <meshStandardMaterial color={C.white} roughness={0.4} />
        </mesh>
      </Pop>
      <Pop show={has("P05", "P06")} position={[1.75, 0, -1.15]} delay={0.1}>
        <Rack />
        <StatusRing live={isLive("P05", "P06")} />
      </Pop>
      <Pop show={has("P09")} position={[0.85, 1.32, -1.38]} delay={0.15}>
        <Router backup />
        <StatusRing live={isLive("P09")} />
      </Pop>
      <Pop show={has("P22")} position={[1.42, 1.55, -1.3]} delay={0.2}>
        <WifiRings />
      </Pop>
      <Pop show={has("P07", "P08", "P12", "P13")} position={[1.35, 1.12, 0.48]}>
        <Phone tilt={-0.3} />
        <group position={[0.24, -0.02, 0.06]}>
          <Phone tilt={-0.6} />
        </group>
        <StatusRing live={isLive("P07", "P08", "P12", "P13")} />
      </Pop>
      <Pop show={has("P19")} position={[0.15, 0.98, 0.5]}>
        <Pos />
        <StatusRing live={isLive("P19")} />
      </Pop>
      <Pop show={has("P23")} position={[-1.98, 2.25, 1.25]}>
        <Cctv />
      </Pop>
      <Pop show={has("P24")} position={[-1.35, 0, 0.75]}>
        <IotSensor />
        <StatusRing live={isLive("P24")} />
      </Pop>
      <Pop show={has("P25")} position={[3.1, 0, 1.25]}>
        <Scooter />
        <StatusRing live={isLive("P25")} />
      </Pop>
      <Pop show={cloudExtras.length > 0} position={[-0.7, 3.75, -0.4]}>
        <Bob>
          <Cloud extras={cloudExtras} />
        </Bob>
      </Pop>
      <Pop show={has("P14", "P15")} position={[1.0, 3.55, 0.6]}>
        <Bob speed={1.6}>
          <ChatBubble />
        </Bob>
      </Pop>
      <Pop show={has("P20", "P21")} position={[-1.75, 3.3, -1.0]}>
        <Bob speed={1}>
          <Shield />
        </Bob>
      </Pop>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

/** Frames the shop for any aspect ratio and adds gentle pointer parallax. */
function Rig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const dist = aspect < 1 ? 15.5 / Math.max(aspect, 0.55) ** 0.65 : 13.5;
    const dir = new THREE.Vector3(0.62, 0.5, 0.72).normalize();
    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0.25, 1.35, 0);
  }, [camera, size]);
  useFrame(({ pointer, clock }) => {
    if (!group.current) return;
    const targetY = pointer.x * 0.25 + Math.sin(clock.elapsedTime * 0.25) * 0.06;
    const targetX = -pointer.y * 0.05;
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.05;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

export default function ShopScene({ items, live, className, glow }: ShopSceneProps) {
  const set = useMemo(() => new Set(items), [items]);
  const liveSet = useMemo(() => (live ? new Set(live) : undefined), [live]);
  return (
    <div className={className} aria-hidden>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 30, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={["#ffffff", "#dfe3f0", 1.6]} />
        <directionalLight position={[5, 9, 6]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0004} />
        <directionalLight position={[-6, 4, -2]} intensity={0.5} color="#cfe8ff" />
        {glow && <pointLight position={[-3, 2.5, -4]} intensity={60} color="#ff3b4f" distance={14} />}
        {glow && <pointLight position={[4, 1, 3]} intensity={18} color="#ff8a5c" distance={9} />}
        <Rig>
          <group position={[-0.2, 0, 0]}>
            <Shop />
            <Tower />
            <Devices items={set} live={liveSet} />
          </group>
          <ContactShadows position={[0, -0.33, 0]} opacity={0.35} scale={12} blur={2.6} far={4} />
        </Rig>
      </Canvas>
    </div>
  );
}
