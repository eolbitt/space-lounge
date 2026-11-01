"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { WORLD_BOUNDS } from "@/lib/constants";

/** Ambient crowd — fills the lounge without crowding real peers. */
const NPC_COUNT = 26;

type NpcSeed = {
  id: string;
  home: THREE.Vector3;
  amp: THREE.Vector3;
  rate: THREE.Vector3;
  phase: THREE.Vector3;
  speed: number;
};

type LiveNpc = {
  id: string;
  position: [number, number, number];
  state: "idle" | "move";
  facing: number;
};

function clampAxis(v: number, min: number, max: number, pad = 4) {
  return THREE.MathUtils.clamp(v, min + pad, max - pad);
}

/** Deterministic pseudo-random in [0,1) from index + salt */
function nrand(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildSeeds(): NpcSeed[] {
  /** Hand-placed cores + generated scatter around the lounge band */
  const homes: [number, number, number][] = [
    [14, 3.5, -8],
    [-16, 5.0, 6],
    [8, -2.5, 16],
    [-10, 8.5, -18],
    [22, 1.2, 4],
    [-20, -1.5, -6],
    [18, 6.5, 14],
    [-24, 3.0, -14],
    [6, 11.0, -6],
    [-8, -3.5, 12],
    [26, -1.0, -10],
    [-14, 9.0, 8],
    [12, 2.0, 22],
    [-28, 4.5, 2],
    [4, -5.0, -20],
    [20, 8.0, -16],
    [-6, 1.5, -24],
    [28, 5.5, 10],
    [-18, -4.0, 18],
    [10, 12.0, 6],
    [-22, 7.0, -8],
    [16, -2.0, -4],
    [-12, 0.5, 20],
    [24, 10.0, -2],
    [-4, 6.0, 14],
    [2, 4.0, -14],
  ];

  return Array.from({ length: NPC_COUNT }, (_, i) => {
    const h = homes[i] ?? [
      (nrand(i, 1) - 0.5) * 52,
      (nrand(i, 2) - 0.35) * 22,
      (nrand(i, 3) - 0.5) * 44,
    ];
    return {
      id: `npc-${i}`,
      home: new THREE.Vector3(h[0], h[1], h[2]),
      amp: new THREE.Vector3(
        5 + nrand(i, 4) * 5.5,
        1.8 + nrand(i, 5) * 2.4,
        5.5 + nrand(i, 6) * 6,
      ),
      rate: new THREE.Vector3(
        0.07 + nrand(i, 7) * 0.09,
        0.05 + nrand(i, 8) * 0.07,
        0.06 + nrand(i, 9) * 0.08,
      ),
      phase: new THREE.Vector3(
        i * 1.07 + nrand(i, 10),
        i * 0.71 + nrand(i, 11),
        i * 1.31 + nrand(i, 12),
      ),
      speed: 0.72 + nrand(i, 13) * 0.45,
    };
  });
}

/**
 * Ambient astronaut NPCs — same suit art, Idle/Move only.
 * Not presence peers: no names, no pod/flag/heart/peer counting.
 */
export function AmbientWanderers() {
  const seeds = useMemo(() => buildSeeds(), []);
  const [bodies, setBodies] = useState<LiveNpc[]>(() =>
    seeds.map((s) => ({
      id: s.id,
      position: [s.home.x, s.home.y, s.home.z],
      state: "idle",
      facing: 1,
    })),
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const prev = useRef<THREE.Vector3[]>([]);
  const facingRef = useRef<number[]>([]);
  const { camera } = useThree();
  const camRight = useRef(new THREE.Vector3());
  const scratch = useRef(new THREE.Vector3());
  const sampleAcc = useRef(0);
  const b = WORLD_BOUNDS;

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    camRight.current.setFromMatrixColumn(camera.matrixWorld, 0);
    camRight.current.y = 0;
    if (camRight.current.lengthSq() > 1e-6) camRight.current.normalize();

    const next: LiveNpc[] = [];
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]!;
      const x =
        s.home.x +
        Math.sin(t * s.rate.x * s.speed + s.phase.x) * s.amp.x +
        Math.sin(t * 0.04 + s.phase.z) * 1.5;
      const y =
        s.home.y + Math.sin(t * s.rate.y * s.speed + s.phase.y) * s.amp.y;
      const z =
        s.home.z +
        Math.cos(t * s.rate.z * s.speed + s.phase.z) * s.amp.z +
        Math.cos(t * 0.035 + s.phase.x) * 1.2;

      scratch.current.set(
        clampAxis(x, -b.x, b.x, 8),
        clampAxis(y, b.yMin, b.yMax, 6),
        // Keep ambient NPCs in the lounge band — not deep sun corridor
        clampAxis(z, b.zMin, Math.min(b.zMax, 42), 8),
      );

      const p = prev.current[i] ?? scratch.current.clone();
      const dx = scratch.current.x - p.x;
      const dz = scratch.current.z - p.z;
      const speed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
      let face = facingRef.current[i] ?? 1;
      const lateral = dx * camRight.current.x + dz * camRight.current.z;
      if (Math.abs(lateral) > 0.0008) face = lateral > 0 ? 1 : -1;
      facingRef.current[i] = face;
      prev.current[i] = scratch.current.clone();

      next.push({
        id: s.id,
        position: [scratch.current.x, scratch.current.y, scratch.current.z],
        state: speed > 0.35 ? "move" : "idle",
        facing: face,
      });

      const g = groups.current[i];
      if (g) g.position.lerp(scratch.current, 1 - Math.pow(0.001, dt));
    }

    sampleAcc.current += dt;
    if (sampleAcc.current > 0.22) {
      sampleAcc.current = 0;
      setBodies(next);
    }
  });

  return (
    <group>
      {bodies.map((v, i) => (
        <group
          key={v.id}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={v.position}
          userData={{ cosmicFocus: true, kind: "npc", id: v.id }}
        >
          <Astronaut state={v.state} scale={1} facing={v.facing} />
        </group>
      ))}
    </group>
  );
}
