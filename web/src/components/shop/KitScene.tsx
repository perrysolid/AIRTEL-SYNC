"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { Bob, C, ChatBubble, Cctv, Cloud, FIBRE, IotSensor, Phone, Pop, Pos, Rack, Router, Scooter, Shield, WifiRings } from "./ShopScene";
import type { ShopSceneProps } from "./ShopScene";

/**
 * The quote's picture: everything in the plan laid out as a kit on a slowly turning display table, one pedestal
 * per device. Toggle an add-on and its device pops onto the table (or off), and the others slide to make room.
 */

type Kind = { key: string; ids: string[]; scale?: number; lift?: number; render: (has: (...ids: string[]) => boolean) => ReactNode };

const KINDS: Kind[] = [
  { key: "backup", ids: ["P09"], render: () => <Router backup /> },
  { key: "rack", ids: ["P05", "P06", "P10"], scale: 0.7, render: () => <Rack /> },
  { key: "phones", ids: ["P07", "P08", "P12", "P13"], lift: 0.2, render: () => (<><Phone tilt={-0.3} /><group position={[0.24, -0.02, 0.06]}><Phone tilt={-0.6} /></group></>) },
  { key: "pos", ids: ["P19"], render: () => <Pos /> },
  { key: "cctv", ids: ["P23"], lift: 0.35, render: () => <group rotation-y={-Math.PI / 2}><Cctv /></group> },
  { key: "chat", ids: ["P14", "P15"], lift: 0.45, scale: 0.8, render: () => <Bob speed={1.6}><ChatBubble /></Bob> },
  { key: "cloud", ids: ["P16", "P17", "P18"], lift: 0.55, scale: 0.55, render: (has) => <Bob><Cloud extras={[has("P16") && "#5b6cff", has("P17") && C.signal, has("P18") && C.marigold].filter(Boolean) as string[]} /></Bob> },
  { key: "shield", ids: ["P20", "P21"], lift: 0.4, scale: 0.75, render: () => <Bob speed={1}><Shield /></Bob> },
  { key: "iot", ids: ["P24"], scale: 0.8, render: () => <IotSensor /> },
  { key: "fleet", ids: ["P25"], scale: 0.45, render: () => <Scooter /> },
];

const RADIUS = 1.75;

/** Slides to its place on the ring when the set of devices changes. */
function Slot({ angle, children }: { angle: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(Math.cos(angle) * RADIUS, 0, Math.sin(angle) * RADIUS), [angle]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.position.lerp(target, Math.min(1, dt * 5));
  });
  return (
    <group ref={ref} position={target.toArray()}>
      {children}
    </group>
  );
}

function Pedestal() {
  return (
    <group>
      <mesh position-y={0.09} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.46, 0.18, 32]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      <mesh position-y={0.185} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.36, 0.42, 40]} />
        <meshBasicMaterial color={C.brand} />
      </mesh>
    </group>
  );
}

function Table({ children }: { children: ReactNode }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.12;
  });
  return (
    <group>
      <mesh position-y={-0.12} receiveShadow castShadow>
        <cylinderGeometry args={[2.75, 2.85, 0.24, 64]} />
        <meshStandardMaterial color="#f4f4f4" roughness={0.7} />
      </mesh>
      <mesh position-y={0.001} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.62, 2.75, 72]} />
        <meshBasicMaterial color={C.brand} />
      </mesh>
      <group ref={spin}>{children}</group>
    </group>
  );
}

/** Pointer parallax and framing for any aspect ratio. */
function Rig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const dist = aspect < 1 ? 12.5 / Math.max(aspect, 0.55) ** 0.6 : 10.5;
    camera.position.copy(new THREE.Vector3(0, 0.62, 0.78).normalize().multiplyScalar(dist));
    camera.lookAt(0, 0.4, 0);
  }, [camera, size]);
  useFrame(({ pointer }) => {
    if (!group.current) return;
    group.current.rotation.x += (-pointer.y * 0.06 - group.current.rotation.x) * 0.05;
    group.current.rotation.z += (pointer.x * 0.04 - group.current.rotation.z) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

export default function KitScene({ items, className }: ShopSceneProps) {
  const set = useMemo(() => new Set(items), [items]);
  const has = (...ids: string[]) => ids.some((id) => set.has(id));
  const kinds = KINDS.filter((k) => has(...k.ids));
  const internet = has(...FIBRE, "P04");
  return (
    <div className={className} aria-hidden>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 30, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }} resize={{ scroll: false }}>
        <hemisphereLight args={["#ffffff", "#e6e6e6", 1.6]} />
        <directionalLight position={[4, 9, 5]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0004} />
        <directionalLight position={[-5, 3, -3]} intensity={0.5} color="#cfe8ff" />
        <Rig>
          <Table>
            {/* the connection in the middle: the router everything else hangs off */}
            <Pop show={internet} position={[0, 0, 0]}>
              <mesh position-y={0.2} castShadow receiveShadow>
                <cylinderGeometry args={[0.6, 0.66, 0.4, 40]} />
                <meshStandardMaterial color="#ffffff" roughness={0.5} />
              </mesh>
              <group position-y={0.48} scale={1.25}>
                <Router />
              </group>
              {has("P22") && (
                <group position-y={1.1}>
                  <WifiRings />
                </group>
              )}
              {has("P04") && (
                <mesh position={[0.45, 0.62, 0]} castShadow>
                  <cylinderGeometry args={[0.12, 0.12, 0.3, 20]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.4} />
                </mesh>
              )}
            </Pop>
            {kinds.map((k, i) => (
              <Slot key={k.key} angle={(i / kinds.length) * Math.PI * 2 + Math.PI / 2}>
                <Pedestal />
                <Pop show position={[0, 0.2 + (k.lift ?? 0), 0]} delay={i * 0.06}>
                  <group scale={k.scale ?? 1}>{k.render(has)}</group>
                </Pop>
              </Slot>
            ))}
          </Table>
          <ContactShadows position={[0, -0.25, 0]} opacity={0.3} scale={9} blur={2.4} far={3} />
        </Rig>
      </Canvas>
    </div>
  );
}
