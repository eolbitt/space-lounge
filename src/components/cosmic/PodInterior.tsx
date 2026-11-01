"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { createMockVisitors, visitorPose } from "@/lib/presence";
import { getPresenceRoom, type PeerPose } from "@/lib/realtime";
import type { AvatarState } from "@/lib/constants";

/** Quiet lounge seats — self sits first; peers + mocks fill the rest. */
const SEATS: [number, number, number, number][] = [
  // [x, y, z, facing] — camera sits near +Z window looking −Z, so faces read clearly
  [0.0, -0.32, -0.15, 1], // player — center, visible from window camera
  [-1.05, -0.38, -0.55, 1],
  [1.05, -0.38, -0.5, -1],
  [-1.4, -0.32, -1.15, 1],
  [1.3, -0.32, -1.05, -1],
  [0.1, -0.28, -1.45, 1],
];

function PodCompanions() {
  const mocks = useMemo(() => createMockVisitors(5), []);
  const [peers, setPeers] = useState<Map<string, PeerPose>>(new Map());
  const [bodies, setBodies] = useState<
    { id: string; state: AvatarState; facing: number; seat: number }[]
  >([]);

  useEffect(() => {
    const room = getPresenceRoom();
    if (!room) return;
    return room.subscribe({
      onPeers: (next) => setPeers(new Map(next)),
    });
  }, []);

  const throttle = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - throttle.current < 0.2) return;
    throttle.current = t;
    const list: {
      id: string;
      state: AvatarState;
      facing: number;
      seat: number;
    }[] = [];
    // Seat 0 reserved for the local player
    let seat = 1;
    for (const peer of peers.values()) {
      if (seat >= SEATS.length) break;
      list.push({
        id: peer.id,
        state: peer.state === "wave" ? "wave" : "idle",
        facing: SEATS[seat][3],
        seat: seat++,
      });
    }
    const budget = Math.max(0, Math.min(4, SEATS.length - list.length));
    mocks.slice(0, budget).forEach((m) => {
      if (seat >= SEATS.length) return;
      const pose = visitorPose(m, t);
      list.push({
        id: m.id,
        state: pose.state === "wave" ? "wave" : "idle",
        facing: SEATS[seat]?.[3] ?? 1,
        seat: seat++,
      });
    });
    setBodies(list);
  });

  return (
    <group>
      {bodies.map((b) => {
        const seat = SEATS[b.seat];
        if (!seat) return null;
        return (
          <group key={b.id} position={[seat[0], seat[1], seat[2]]}>
            <Astronaut state={b.state} scale={0.78} facing={seat[3]} />
          </group>
        );
      })}
    </group>
  );
}

function PlayerSeat() {
  const seat = SEATS[0];
  return (
    <group position={[seat[0], seat[1], seat[2]]}>
      {/* idle reads face-forward on the billboard; rest sprite shows the backpack */}
      <Astronaut self state="idle" scale={0.95} facing={seat[3]} />
    </group>
  );
}

/** Warm lit lounge — camera sits inside, looking toward the window. */
function InteriorScene() {
  const lamp = useRef<THREE.PointLight>(null);
  const windowGlow = useRef<THREE.Mesh>(null);
  const podTex = useTexture("/assets/objects/lounge-pod.png") as THREE.Texture;
  podTex.colorSpace = THREE.SRGBColorSpace;

  const starGeo = useMemo(() => {
    const count = 280;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Only beyond the window (+Z outside)
      pos[i * 3] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 3.5;
      pos[i * 3 + 2] = 3.6 + Math.random() * 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lamp.current) {
      lamp.current.intensity = 2.1 + Math.sin(t * 1.2) * 0.15;
    }
    if (windowGlow.current) {
      const m = windowGlow.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.35 + Math.sin(t * 0.7) * 0.08;
    }
  });

  return (
    <>
      <color attach="background" args={["#1c1410"]} />
      <fog attach="fog" args={["#1c1410", 10, 22]} />

      {/* Bright warm key + fill — interior must read clearly */}
      <ambientLight intensity={0.85} color="#ffe2b8" />
      <hemisphereLight args={["#ffd9a0", "#2a1c14", 0.55]} />
      <pointLight
        ref={lamp}
        position={[0.1, 1.35, -0.1]}
        intensity={2.2}
        distance={12}
        decay={2}
        color="#ffc878"
      />
      <pointLight
        position={[-1.2, 0.6, 0.8]}
        intensity={0.85}
        distance={7}
        color="#ffb060"
      />
      <pointLight
        position={[1.3, 0.55, 0.6]}
        intensity={0.7}
        distance={6}
        color="#88aacc"
      />
      <pointLight
        position={[0, 0.2, 1.4]}
        intensity={0.55}
        distance={5}
        color="#c8e0ff"
      />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]}>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial
          color="#8b6a4e"
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>
      {/* Soft rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.93, -0.2]}>
        <circleGeometry args={[1.65, 32]} />
        <meshStandardMaterial color="#c4a07a" roughness={1} />
      </mesh>

      {/* Back wall (−Z) */}
      <mesh position={[0, 0.55, -2.15]}>
        <boxGeometry args={[5.4, 3.2, 0.12]} />
        <meshStandardMaterial color="#c9a888" roughness={0.82} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-2.45, 0.55, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[4.2, 3.2, 0.12]} />
        <meshStandardMaterial color="#b89878" roughness={0.84} />
      </mesh>
      <mesh position={[2.45, 0.55, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[4.2, 3.2, 0.12]} />
        <meshStandardMaterial color="#b89878" roughness={0.84} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, 2.0, 0]}>
        <boxGeometry args={[5.4, 0.1, 4.4]} />
        <meshStandardMaterial color="#a88868" roughness={0.9} />
      </mesh>
      {/* Wall trim */}
      <mesh position={[0, -0.85, -2.08]}>
        <boxGeometry args={[5.2, 0.18, 0.08]} />
        <meshStandardMaterial color="#8a6848" roughness={0.7} />
      </mesh>

      {/* Front wall with window opening (+Z) */}
      <mesh position={[-1.7, 0.55, 2.0]}>
        <boxGeometry args={[1.4, 3.2, 0.12]} />
        <meshStandardMaterial color="#5a4638" roughness={0.85} metalness={0.08} />
      </mesh>
      <mesh position={[1.7, 0.55, 2.0]}>
        <boxGeometry args={[1.4, 3.2, 0.12]} />
        <meshStandardMaterial color="#5a4638" roughness={0.85} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.55, 2.0]}>
        <boxGeometry args={[2.0, 1.2, 0.12]} />
        <meshStandardMaterial color="#5a4638" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.55, 2.0]}>
        <boxGeometry args={[2.0, 1.0, 0.12]} />
        <meshStandardMaterial color="#5a4638" roughness={0.85} />
      </mesh>

      {/* Window frame */}
      <mesh position={[0, 0.55, 2.02]}>
        <boxGeometry args={[2.15, 1.55, 0.06]} />
        <meshStandardMaterial
          color="#2a2218"
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
      {/* Space through window */}
      <mesh position={[0, 0.55, 2.12]}>
        <planeGeometry args={[1.95, 1.35]} />
        <meshBasicMaterial color="#060914" toneMapped={false} />
      </mesh>
      <mesh ref={windowGlow} position={[0, 0.55, 2.08]}>
        <planeGeometry args={[2.05, 1.45]} />
        <meshBasicMaterial
          color="#7aa8ff"
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* Stars only outside the window */}
      <points geometry={starGeo} frustumCulled={false}>
        <pointsMaterial
          size={0.04}
          color="#eef3ff"
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Cozy seats — low backs so avatars stay readable */}
      <mesh position={[-1.05, -0.72, -0.55]}>
        <boxGeometry args={[0.9, 0.34, 0.8]} />
        <meshStandardMaterial color="#7a5a40" roughness={0.8} />
      </mesh>
      <mesh position={[-1.05, -0.42, -0.85]}>
        <boxGeometry args={[0.9, 0.28, 0.12]} />
        <meshStandardMaterial color="#7a5a40" roughness={0.8} />
      </mesh>
      <mesh position={[1.05, -0.72, -0.5]}>
        <boxGeometry args={[0.9, 0.34, 0.8]} />
        <meshStandardMaterial color="#7a5a40" roughness={0.8} />
      </mesh>
      <mesh position={[1.05, -0.42, -0.8]}>
        <boxGeometry args={[0.9, 0.28, 0.12]} />
        <meshStandardMaterial color="#7a5a40" roughness={0.8} />
      </mesh>
      {/* Player cushion */}
      <mesh position={[0, -0.7, -0.15]}>
        <boxGeometry args={[1.05, 0.3, 0.85]} />
        <meshStandardMaterial color="#8a6448" roughness={0.78} />
      </mesh>
      <mesh position={[0, -0.42, -0.48]}>
        <boxGeometry args={[1.05, 0.28, 0.12]} />
        <meshStandardMaterial color="#8a6448" roughness={0.78} />
      </mesh>

      {/* Side table + lamp */}
      <mesh position={[1.25, -0.78, 0.35]}>
        <cylinderGeometry args={[0.32, 0.36, 0.4, 16]} />
        <meshStandardMaterial color="#5a4030" roughness={0.75} />
      </mesh>
      <mesh position={[1.25, -0.45, 0.35]}>
        <cylinderGeometry args={[0.08, 0.1, 0.35, 12]} />
        <meshStandardMaterial color="#d8c4a0" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[1.25, -0.22, 0.35]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshBasicMaterial color="#ffd090" toneMapped={false} />
      </mesh>
      <pointLight
        position={[1.25, -0.15, 0.35]}
        intensity={1.0}
        distance={3.2}
        color="#ffc070"
      />

      {/* Decorative lounge-pod art on back wall */}
      <mesh position={[0, 0.85, -2.05]} scale={[1.55, 1.7, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={podTex}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <PlayerSeat />
      <PodCompanions />
    </>
  );
}

type Props = {
  visible: boolean;
  onExit: () => void;
};

export function PodInterior({ visible, onExit }: Props) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 animate-fade-in bg-[#1c1410]">
      <Canvas
        className="absolute inset-0 h-full w-full"
        // Three-quarter view: avatars + warm room + window glimpse
        camera={{ position: [1.55, 1.05, 1.35], fov: 50, near: 0.05, far: 40 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.75]}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color("#1c1410"));
          gl.toneMapping = THREE.NoToneMapping;
          camera.lookAt(-0.35, -0.05, -0.45);
        }}
      >
        <InteriorScene />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a120c]/4 via-transparent to-[#1a120c]/15" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5">
        <div>
          <p className="font-display text-lg text-[#f3e6d4]">라운지 포드</p>
          <p className="mt-1 font-sans text-xs text-[#c8b8a0]">
            조용한 안쪽 · 같은 우주에 있는 사람들
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-6">
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto rounded-full border border-[#e8d4b8]/35 bg-[#2a2018]/75 px-6 py-3 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d4b8]"
        >
          우주로 나가기
        </button>
      </div>
    </div>
  );
}
