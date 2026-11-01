"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { createMockVisitors, visitorPose } from "@/lib/presence";
import { getPresenceRoom, type PeerPose } from "@/lib/realtime";
import type { AvatarState } from "@/lib/constants";
import { touchMove, touchMoveActive } from "@/lib/touchMove";

/** Pod floor bounds (XZ) — open center for walking */
const FLOOR = {
  minX: -4.2,
  maxX: 4.2,
  minZ: -3.4,
  maxZ: 3.2,
} as const;

const PLAYER_R = 0.28;
const WALK_SPEED = 2.35;
const FLOOR_Y = 0;

type CircleHit = { kind: "circle"; x: number; z: number; r: number };
type BoxHit = {
  kind: "box";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
type Hit = CircleHit | BoxHit;

/** Invisible collision — walls & furniture (camera-side is open cutaway) */
const COLLIDERS: Hit[] = [
  { kind: "box", minX: -4.55, maxX: -4.15, minZ: -3.6, maxZ: 3.4 },
  { kind: "box", minX: 4.15, maxX: 4.55, minZ: -3.6, maxZ: 3.4 },
  { kind: "box", minX: -4.5, maxX: 4.5, minZ: -3.75, maxZ: -3.35 },
  { kind: "box", minX: -4.5, maxX: 4.5, minZ: 3.15, maxZ: 3.55 },
  { kind: "circle", x: -2.6, z: 1.8, r: 0.55 },
  { kind: "circle", x: -1.35, z: 2.15, r: 0.55 },
  { kind: "circle", x: 2.4, z: 1.7, r: 0.55 },
  { kind: "circle", x: 1.2, z: -2.35, r: 0.55 },
  { kind: "circle", x: -2.2, z: -2.2, r: 0.55 },
  { kind: "box", minX: 2.85, maxX: 4.05, minZ: -1.35, maxZ: 1.35 },
  { kind: "box", minX: -3.2, maxX: 1.6, minZ: -3.35, maxZ: -2.85 },
  { kind: "circle", x: 3.35, z: -2.55, r: 0.4 },
  { kind: "circle", x: -3.5, z: -0.2, r: 0.38 },
];

function circleHitsBox(x: number, z: number, r: number, b: BoxHit) {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

function blocked(x: number, z: number, r = PLAYER_R): boolean {
  if (
    x - r < FLOOR.minX ||
    x + r > FLOOR.maxX ||
    z - r < FLOOR.minZ ||
    z + r > FLOOR.maxZ
  ) {
    return true;
  }
  for (const h of COLLIDERS) {
    if (h.kind === "circle") {
      const dx = x - h.x;
      const dz = z - h.z;
      if (dx * dx + dz * dz < (r + h.r) * (r + h.r)) return true;
    } else if (circleHitsBox(x, z, r, h)) {
      return true;
    }
  }
  return false;
}

function tryMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
): [number, number] {
  const nx = x + dx;
  const nz = z + dz;
  if (!blocked(nx, nz)) return [nx, nz];
  if (!blocked(x + dx, z)) return [x + dx, z];
  if (!blocked(x, z + dz)) return [x, z + dz];
  return [x, z];
}

const keys = new Set<string>();

function useWalkKeys(active: boolean) {
  useEffect(() => {
    if (!active) {
      keys.clear();
      return;
    }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      ) {
        e.preventDefault();
        keys.add(k);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.clear();
    };
  }, [active]);
}

function PodWalker() {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [state, setState] = useState<AvatarState>("idle");
  const [facing, setFacing] = useState(1);
  const pos = useRef(new THREE.Vector3(0.2, FLOOR_Y, 0.6));
  const publishAcc = useRef(0);
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const wish = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3(6.2, 5.6, 6.8));

  useWalkKeys(true);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const clamped = Math.min(dt, 0.05);

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 1e-6) forward.current.set(0, 0, -1);
    forward.current.normalize();
    right.current
      .crossVectors(forward.current, new THREE.Vector3(0, 1, 0))
      .normalize();

    let mx = 0;
    let mz = 0;
    if (keys.has("w") || keys.has("arrowup")) mz += 1;
    if (keys.has("s") || keys.has("arrowdown")) mz -= 1;
    if (keys.has("d") || keys.has("arrowright")) mx += 1;
    if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
    if (touchMoveActive()) {
      mx += touchMove.x;
      mz += touchMove.y;
    }

    wish.current.set(0, 0, 0);
    if (mx !== 0 || mz !== 0) {
      wish.current
        .addScaledVector(right.current, mx)
        .addScaledVector(forward.current, mz);
      if (wish.current.lengthSq() > 1e-6) wish.current.normalize();
    }

    const moving = wish.current.lengthSq() > 1e-4;
    if (moving) {
      const step = WALK_SPEED * clamped;
      const [nx, nz] = tryMove(
        pos.current.x,
        pos.current.z,
        wish.current.x * step,
        wish.current.z * step,
      );
      pos.current.x = nx;
      pos.current.z = nz;
      pos.current.y = FLOOR_Y;
      setState("move");
      if (Math.abs(wish.current.x) > 0.08) {
        setFacing(wish.current.x >= 0 ? 1 : -1);
      }
    } else {
      setState("idle");
    }

    g.position.copy(pos.current);

    // Dollhouse follow — stay outside the open corner
    camTarget.current.set(
      pos.current.x * 0.4,
      0.7,
      pos.current.z * 0.35 - 0.4,
    );
    const desired = new THREE.Vector3(
      5.4 + pos.current.x * 0.2,
      5.4,
      6.0 + pos.current.z * 0.15,
    );
    camPos.current.lerp(desired, 1 - Math.pow(0.001, clamped));
    camera.position.copy(camPos.current);
    camera.lookAt(camTarget.current);

    publishAcc.current += clamped;
    if (publishAcc.current > 0.12) {
      publishAcc.current = 0;
      getPresenceRoom()?.publishLounge(
        [pos.current.x, pos.current.z],
        moving ? "move" : "idle",
      );
    }
  });

  return (
    <group ref={group} position={[0.2, FLOOR_Y, 0.6]}>
      <Astronaut self state={state} scale={0.92} facing={facing} tilt={0} />
    </group>
  );
}

function LoungePeers() {
  const mocks = useMemo(() => createMockVisitors(4), []);
  const [peers, setPeers] = useState<Map<string, PeerPose>>(new Map());

  useEffect(() => {
    const r = getPresenceRoom();
    if (!r) return;
    return r.subscribe({
      onPeers: (next) => setPeers(new Map(next)),
    });
  }, []);

  const bodies = useMemo(() => {
    const list: {
      id: string;
      x: number;
      z: number;
      state: AvatarState;
      facing: number;
    }[] = [];
    let i = 0;
    for (const peer of peers.values()) {
      if (peer.lounge) {
        list.push({
          id: peer.id,
          x: peer.lounge[0],
          z: peer.lounge[1],
          state: peer.state === "move" ? "move" : "idle",
          facing: 1,
        });
      } else if (i < 3) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        list.push({
          id: peer.id,
          x: Math.cos(a) * 2.1,
          z: Math.sin(a) * 1.5 - 0.2,
          state: "idle",
          facing: Math.cos(a) > 0 ? 1 : -1,
        });
        i++;
      }
    }
    return list;
  }, [peers]);

  const mockRefs = useRef(
    mocks.map((_, idx) => {
      const a = idx * 1.7;
      return {
        x: Math.cos(a) * 1.4,
        z: Math.sin(a) * 1.1,
        facing: 1 as number,
        state: "idle" as AvatarState,
      };
    }),
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mocks.forEach((m, idx) => {
      visitorPose(m, t);
      const slot = mockRefs.current[idx];
      if (!slot) return;
      const a = idx * 1.7 + t * 0.12;
      const tx = Math.cos(a) * (1.2 + (idx % 2) * 0.35);
      const tz = Math.sin(a * 0.9) * (0.9 + (idx % 3) * 0.2);
      if (!blocked(tx, tz, 0.3)) {
        const prevX = slot.x;
        slot.x = THREE.MathUtils.lerp(slot.x, tx, 0.02);
        slot.z = THREE.MathUtils.lerp(slot.z, tz, 0.02);
        if (Math.abs(slot.x - prevX) > 0.001) {
          slot.facing = slot.x >= prevX ? 1 : -1;
        }
      }
      slot.state = "idle";
    });
  });

  return (
    <group>
      {bodies.map((b) => (
        <group key={b.id} position={[b.x, FLOOR_Y, b.z]}>
          <Astronaut state={b.state} scale={0.85} facing={b.facing} />
        </group>
      ))}
      {mocks.map((m, idx) => {
        const slot = mockRefs.current[idx];
        if (!slot) return null;
        return (
          <group key={m.id} position={[slot.x, FLOOR_Y, slot.z]}>
            <Astronaut state={slot.state} scale={0.82} facing={slot.facing} />
          </group>
        );
      })}
    </group>
  );
}

function WarmChair({
  position,
  yaw = 0,
}: {
  position: [number, number, number];
  yaw?: number;
}) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.48, 0.16, 24]} />
        <meshStandardMaterial color="#8a6848" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.42, 0.02]} castShadow>
        <boxGeometry args={[0.72, 0.22, 0.7]} />
        <meshStandardMaterial color="#d4b896" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.72, -0.28]} castShadow>
        <boxGeometry args={[0.72, 0.55, 0.12]} />
        <meshStandardMaterial color="#c9a882" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.48, 0.05]}>
        <boxGeometry args={[0.62, 0.08, 0.55]} />
        <meshStandardMaterial color="#e8c9a4" roughness={0.85} />
      </mesh>
    </group>
  );
}

function LoungeScene() {
  const earth = useTexture("/assets/objects/earth.png") as THREE.Texture;
  earth.colorSpace = THREE.SRGBColorSpace;
  const lamp = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (lamp.current) {
      lamp.current.intensity = 1.45 + Math.sin(clock.elapsedTime * 0.9) * 0.12;
    }
  });

  return (
    <>
      <color attach="background" args={["#140e0c"]} />
      <fog attach="fog" args={["#241810", 16, 32]} />

      <ambientLight intensity={0.62} color="#ffe2c4" />
      <hemisphereLight args={["#ffe8d0", "#3a2818", 0.5]} />
      <directionalLight
        position={[3, 9, 4]}
        intensity={0.65}
        color="#ffd4a8"
        castShadow
      />
      <pointLight
        ref={lamp}
        position={[-1.0, 2.6, -2.0]}
        intensity={1.5}
        distance={16}
        decay={2}
        color="#ffc078"
      />
      <pointLight
        position={[2.8, 2.0, 1.2]}
        intensity={0.75}
        distance={9}
        color="#ffb878"
      />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[9.0, 7.0]} />
        <meshStandardMaterial color="#b8956e" roughness={0.92} metalness={0.03} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0.15]}>
        <planeGeometry args={[5.0, 3.8]} />
        <meshStandardMaterial color="#9a7a58" roughness={0.96} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.15]}>
        <planeGeometry args={[3.4, 2.5]} />
        <meshStandardMaterial color="#cbb08a" roughness={1} />
      </mesh>

      {/* Far wall (−Z) with panoramic window */}
      <mesh position={[0, 1.6, -3.52]} receiveShadow>
        <boxGeometry args={[9.0, 3.3, 0.14]} />
        <meshStandardMaterial color="#e8d8c0" roughness={0.82} />
      </mesh>
      {/* Left wall (−X) */}
      <mesh position={[-4.42, 1.6, -0.2]} receiveShadow>
        <boxGeometry args={[0.14, 3.3, 6.8]} />
        <meshStandardMaterial color="#e0d0b8" roughness={0.84} />
      </mesh>
      {/* Partial right wall (+X) — stops short so cutaway stays open */}
      <mesh position={[4.42, 1.6, -1.4]} receiveShadow>
        <boxGeometry args={[0.14, 3.3, 4.2]} />
        <meshStandardMaterial color="#e0d0b8" roughness={0.84} />
      </mesh>
      {/* Partial back wall (+Z) — low half-wall only */}
      <mesh position={[-0.6, 0.55, 3.35]} receiveShadow>
        <boxGeometry args={[7.2, 1.15, 0.12]} />
        <meshStandardMaterial color="#d8c4a8" roughness={0.85} />
      </mesh>
      {/* Ceiling slab — only over the far half (cutaway near camera) */}
      <mesh position={[0, 3.2, -1.35]}>
        <boxGeometry args={[9.0, 0.1, 4.4]} />
        <meshStandardMaterial color="#d4c0a4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.08, -1.8]}>
        <boxGeometry args={[6.2, 0.04, 0.22]} />
        <meshBasicMaterial color="#ffd7a8" toneMapped={false} />
      </mesh>

      {/* Window opening */}
      <mesh position={[-0.5, 1.55, -3.44]}>
        <planeGeometry args={[5.4, 2.2]} />
        <meshBasicMaterial color="#070c14" toneMapped={false} />
      </mesh>
      <mesh position={[-0.5, 1.55, -3.4]} scale={[4.0, 4.0, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={earth}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-0.5, 1.55, -3.38]}>
        <planeGeometry args={[5.5, 2.3]} />
        <meshBasicMaterial
          color="#ffb070"
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {[-2.2, -0.5, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.55, -3.42]}>
          <boxGeometry args={[0.07, 2.3, 0.08]} />
          <meshStandardMaterial
            color="#8a6a48"
            roughness={0.55}
            metalness={0.18}
          />
        </mesh>
      ))}
      <mesh position={[-0.5, 1.55, -3.42]}>
        <boxGeometry args={[5.5, 0.07, 0.08]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.55} metalness={0.18} />
      </mesh>
      {/* Window sill */}
      <mesh position={[-0.5, 0.42, -3.1]}>
        <boxGeometry args={[5.6, 0.12, 0.55]} />
        <meshStandardMaterial color="#c4a888" roughness={0.7} />
      </mesh>

      {/* Perimeter chairs — center open */}
      <WarmChair position={[-2.6, 0, 1.8]} yaw={0.5} />
      <WarmChair position={[-1.35, 0, 2.15]} yaw={0.15} />
      <WarmChair position={[2.4, 0, 1.7]} yaw={-0.55} />
      <WarmChair position={[1.2, 0, -2.35]} yaw={Math.PI * 0.9} />
      <WarmChair position={[-2.2, 0, -2.2]} yaw={Math.PI * 1.1} />

      {/* Console */}
      <mesh position={[3.45, 0.55, -0.4]} castShadow>
        <boxGeometry args={[0.9, 1.1, 2.2]} />
        <meshStandardMaterial color="#c4a888" roughness={0.75} />
      </mesh>
      <mesh position={[3.32, 1.15, -0.4]}>
        <boxGeometry args={[0.08, 0.7, 1.4]} />
        <meshBasicMaterial color="#f0c090" toneMapped={false} />
      </mesh>
      <pointLight
        position={[3.05, 1.2, -0.4]}
        intensity={0.6}
        distance={4.2}
        color="#ffc878"
      />

      {/* Lamp */}
      <mesh position={[3.35, 0.35, -2.55]}>
        <cylinderGeometry args={[0.22, 0.26, 0.7, 16]} />
        <meshStandardMaterial color="#6a4a32" roughness={0.7} />
      </mesh>
      <mesh position={[3.35, 0.85, -2.55]}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshBasicMaterial color="#ffd090" toneMapped={false} />
      </mesh>
      <pointLight
        position={[3.35, 0.9, -2.55]}
        intensity={0.85}
        distance={3.6}
        color="#ffc070"
      />

      {/* Planter */}
      <mesh position={[-3.5, 0.25, -0.2]}>
        <cylinderGeometry args={[0.28, 0.32, 0.5, 16]} />
        <meshStandardMaterial color="#7a5a40" roughness={0.8} />
      </mesh>
      <mesh position={[-3.5, 0.62, -0.2]}>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color="#5a7a48" roughness={0.9} />
      </mesh>

      <PodWalker />
      <LoungePeers />
    </>
  );
}

type Props = {
  visible: boolean;
  onExit: () => void;
};

export function PodInterior({ visible, onExit }: Props) {
  useEffect(() => {
    if (!visible) return;
    getPresenceRoom()?.publishLounge([0.2, 0.6], "idle");
    return () => {
      getPresenceRoom()?.clearLounge();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 animate-fade-in bg-[#140e0c]">
      <Canvas
        className="absolute inset-0 h-full w-full touch-none"
        camera={{ position: [6.2, 5.6, 6.8], fov: 40, near: 0.05, far: 60 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.75]}
        shadows
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color("#140e0c"));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          camera.lookAt(0, 0.7, -0.5);
        }}
      >
        <LoungeScene />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#140e0c]/4 via-transparent to-[#140e0c]/18" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5">
        <div>
          <p className="font-display text-lg text-[#f3e6d4]">라운지 포드</p>
          <p className="mt-1 font-sans text-xs text-[#c8b8a0]">
            걷기 · 중앙 바닥 · 가구는 지나갈 수 없어요
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-50 flex justify-center p-6">
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto rounded-full border border-[#e8d4b8]/35 bg-[#2a2018]/8 px-6 py-3 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d4b8]"
        >
          우주로 나가기
        </button>
      </div>
    </div>
  );
}
