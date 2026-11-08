"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { C, Tower, WifiRings } from "./ShopScene";
import type { ShopSceneProps } from "./ShopScene";

/**
 * The tracker's picture: the road from our tower to the owner's shop. The installation van drives along it as
 * services go live, laying the fibre behind it; a lamp post per service turns green when that service is live,
 * and the shop lights up with Wi-Fi once everything is.
 */

const START = -2.4;
const END = 2.15;
const ROAD_Z = 0.55;

function Ground() {
  return (
    <group>
      <RoundedBox args={[8.2, 0.24, 3.6]} radius={0.12} smoothness={4} position={[0, -0.12, 0]} receiveShadow>
        <meshStandardMaterial color="#efefef" roughness={0.85} />
      </RoundedBox>
      <mesh position={[0, 0.005, ROAD_Z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[7.6, 0.9]} />
        <meshStandardMaterial color="#cfd2d7" roughness={0.9} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-3.4 + i * 0.62, 0.01, ROAD_Z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.3, 0.05]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

/** The fibre laid so far, from the tower to wherever the van has reached. */
function Cable({ to }: { to: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const len = Math.max(0.01, to.current - -3.2);
    ref.current.scale.x = len;
    ref.current.position.x = -3.2 + len / 2;
  });
  return (
    <mesh ref={ref} position={[0, 0.04, ROAD_Z - 0.62]}>
      <boxGeometry args={[1, 0.05, 0.05]} />
      <meshStandardMaterial color={C.brand} emissive={C.brand} emissiveIntensity={0.35} />
    </mesh>
  );
}

function Van({ x }: { x: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Mesh | null)[]>([]);
  const last = useRef(x.current);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const moved = x.current - last.current;
    last.current = x.current;
    ref.current.position.x = x.current;
    ref.current.position.y = Math.abs(moved) > 0.0005 ? Math.abs(Math.sin(clock.elapsedTime * 18)) * 0.015 : 0;
    for (const w of wheels.current) if (w) w.rotation.y -= moved * 6;
  });
  return (
    <group ref={ref} position={[x.current, 0, ROAD_Z]}>
      <RoundedBox args={[0.9, 0.46, 0.46]} radius={0.07} position={[-0.08, 0.36, 0]} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.34, 0.44]} radius={0.06} position={[0.48, 0.3, 0]} castShadow>
        <meshStandardMaterial color={C.brand} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0.62, 0.38, 0]}>
        <boxGeometry args={[0.08, 0.16, 0.38]} />
        <meshStandardMaterial color="#9fd3ff" emissive="#5bb8ff" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[-0.08, 0.38, 0.235]}>
        <boxGeometry args={[0.6, 0.08, 0.01]} />
        <meshBasicMaterial color={C.brand} />
      </mesh>
      {/* a cable drum on the roof */}
      <mesh position={[-0.15, 0.68, 0]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.2, 20]} />
        <meshStandardMaterial color={C.brand} roughness={0.5} />
      </mesh>
      {[
        [-0.38, 0.11, 0.24],
        [-0.38, 0.11, -0.24],
        [0.42, 0.11, 0.24],
        [0.42, 0.11, -0.24],
      ].map((p, i) => (
        <mesh key={i} ref={(m) => void (wheels.current[i] = m)} position={p as [number, number, number]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.07, 16]} />
          <meshStandardMaterial color="#2b2b2b" />
        </mesh>
      ))}
    </group>
  );
}

/** A lamp post per service: pulsing marigold while it's being set up, solid green once it's live. */
function Post({ x, live }: { x: number; live: boolean }) {
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.emissiveIntensity = live ? 0.9 : 0.35 + (Math.sin(clock.elapsedTime * 4 + x) + 1) * 0.3;
  });
  return (
    <group position={[x, 0, ROAD_Z + 0.75]}>
      <mesh position-y={0.42} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 0.84, 8]} />
        <meshStandardMaterial color="#b9bcc3" />
      </mesh>
      <mesh position-y={0.88} castShadow>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial ref={lamp} color={live ? C.signal : C.marigold} emissive={live ? C.signal : C.marigold} />
      </mesh>
    </group>
  );
}

function Shop({ lit }: { lit: boolean }) {
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const t = useRef(0);
  const off = useMemo(() => new THREE.Color("#3a3b40"), []);
  const on = useMemo(() => new THREE.Color("#ffd98c"), []);
  useFrame((_, dt) => {
    t.current += ((lit ? 1 : 0) - t.current) * Math.min(1, dt * 3);
    if (glass.current) {
      glass.current.color.copy(off).lerp(on, t.current);
      glass.current.emissive.copy(on);
      glass.current.emissiveIntensity = t.current * 0.6;
    }
  });
  return (
    <group position={[3.05, 0, -0.55]}>
      <RoundedBox args={[1.6, 1.5, 1.3]} radius={0.05} smoothness={3} position={[0, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f3dfc0" roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, 1.54, 0]} castShadow>
        <boxGeometry args={[1.66, 0.08, 1.36]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.55, 0.66]}>
        <boxGeometry args={[1.15, 0.72, 0.02]} />
        <meshStandardMaterial ref={glass} color="#3a3b40" roughness={0.3} />
      </mesh>
      {/* striped awning */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-0.68 + i * 0.272, 1.08, 0.82]} rotation-x={0.45} castShadow>
          <boxGeometry args={[0.272, 0.04, 0.42]} />
          <meshStandardMaterial color={i % 2 ? "#ffffff" : C.brand} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.33, 0.66]}>
        <boxGeometry args={[1.0, 0.22, 0.04]} />
        <meshStandardMaterial color={C.brand} />
      </mesh>
      {lit && (
        <group position={[0, 1.9, 0]}>
          <WifiRings />
        </group>
      )}
    </group>
  );
}

function Rig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const dist = aspect < 1.2 ? 15 / Math.max(aspect, 0.55) ** 0.7 : 12.5;
    camera.position.copy(new THREE.Vector3(0.25, 0.55, 0.8).normalize().multiplyScalar(dist));
    camera.lookAt(0.2, 0.7, 0);
  }, [camera, size]);
  useFrame(({ pointer }) => {
    if (group.current) group.current.rotation.y += (pointer.x * 0.15 - group.current.rotation.y) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

/** Eases the van toward where it should be, so a newly live service is a short drive, not a jump. */
function Drive({ target, x }: { target: number; x: React.MutableRefObject<number> }) {
  useFrame((_, dt) => {
    x.current += (target - x.current) * Math.min(1, dt * 1.2);
  });
  return null;
}

export default function RouteScene({ items, live, className }: ShopSceneProps) {
  const total = Math.max(1, items.length);
  const liveSet = useMemo(() => new Set(live ?? []), [live]);
  const done = items.filter((id) => liveSet.has(id)).length;
  const target = START + (END - START) * (done / total);
  const x = useRef(START);
  const posts = items.map((id, i) => ({ id, x: START + 0.45 + ((END - START - 0.45) * (i + 1)) / total, live: liveSet.has(id) }));
  return (
    <div className={className} aria-hidden>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 30, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }} resize={{ scroll: false }}>
        <hemisphereLight args={["#ffffff", "#e6e6e6", 1.6]} />
        <directionalLight position={[3, 9, 6]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0004} />
        <directionalLight position={[-6, 3, -2]} intensity={0.5} color="#cfe8ff" />
        <Drive target={target} x={x} />
        <Rig>
          <Ground />
          {/* Tower draws itself at (3.35, 0, -1.3); shift it to the start of the road */}
          <group position={[-6.65, 0, 0.6]} scale={0.8}>
            <Tower />
          </group>
          <Cable to={x} />
          <Van x={x} />
          {posts.map((p) => (
            <Post key={p.id} x={p.x} live={p.live} />
          ))}
          <Shop lit={done === items.length && items.length > 0} />
          <ContactShadows position={[0, -0.23, 0]} opacity={0.3} scale={10} blur={2.4} far={3} />
        </Rig>
      </Canvas>
    </div>
  );
}
