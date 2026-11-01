"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { EARTH_POS, SUN_POS } from "@/lib/solarSystem";

type Pattern = {
  id: string;
  /** Local 2D star coords in constellation plane (side, up) before world map */
  stars: [number, number][];
  /** Edge pairs by star index */
  edges: [number, number][];
  /** Corridor frac ∈ (0,1) Sun→Earth */
  frac: number;
  /** Lateral offsets (side, up) — keep clear of planet sprites */
  side: number;
  up: number;
  scale: number;
};

/**
 * Recognizable linked-star patterns in the Sun↔Earth band.
 * Placed off the planet corridor so labels/sprites stay readable.
 * Fracs sit between packed planet slots; |side|/|up| leave a clear gap.
 */
const PATTERNS: Pattern[] = [
  {
    id: "dipper",
    stars: [
      [-3.2, -0.4],
      [-1.8, 0.2],
      [-0.6, 0.35],
      [0.5, 0.15],
      [1.4, 1.1],
      [2.6, 1.35],
      [3.4, 0.45],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [3, 6],
    ],
    frac: 0.58,
    side: -32,
    up: 36,
    scale: 3.4,
  },
  {
    id: "orion",
    stars: [
      [-2.4, 2.6],
      [2.2, 2.4],
      [-1.6, 0.15],
      [0, 0],
      [1.5, -0.1],
      [-1.8, -2.5],
      [1.9, -2.7],
      [0.2, 3.4],
    ],
    edges: [
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
      [0, 7],
      [1, 7],
    ],
    frac: 0.66,
    side: 34,
    up: -32,
    scale: 3.1,
  },
  {
    id: "cass",
    stars: [
      [-3.0, 0.2],
      [-1.5, 1.4],
      [0, 0.1],
      [1.5, 1.35],
      [3.0, 0.15],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    frac: 0.79,
    side: -30,
    up: 30,
    scale: 2.9,
  },
  {
    id: "cross",
    stars: [
      [0, 2.4],
      [0, -2.2],
      [-1.8, 0.2],
      [1.9, 0.15],
      [0.85, 0.9],
    ],
    edges: [
      [0, 1],
      [2, 3],
    ],
    frac: 0.72,
    side: 30,
    up: -28,
    scale: 2.8,
  },
  {
    id: "triangle",
    stars: [
      [0, 2.8],
      [-2.6, -1.6],
      [2.5, -1.5],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
    frac: 0.85,
    side: 28,
    up: 32,
    scale: 3.2,
  },
];

function corridorFrame() {
  const toEarth = EARTH_POS.clone().sub(SUN_POS);
  const dist = toEarth.length();
  const forward = toEarth.normalize();
  const side = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();
  const up = new THREE.Vector3().crossVectors(side, forward).normalize();
  return { dist, forward, side, up };
}

function patternWorld(p: Pattern) {
  const { dist, forward, side, up } = corridorFrame();
  const origin = SUN_POS.clone()
    .add(forward.clone().multiplyScalar(dist * p.frac))
    .add(side.clone().multiplyScalar(p.side))
    .add(up.clone().multiplyScalar(p.up));

  const points = p.stars.map(([sx, sy]) =>
    origin
      .clone()
      .add(side.clone().multiplyScalar(sx * p.scale))
      .add(up.clone().multiplyScalar(sy * p.scale)),
  );
  return { points, edges: p.edges };
}

export function Constellations() {
  const data = useMemo(() => {
    const linePositions: number[] = [];
    const starPositions: number[] = [];

    for (const pattern of PATTERNS) {
      const { points, edges } = patternWorld(pattern);
      for (const pt of points) {
        starPositions.push(pt.x, pt.y, pt.z);
      }
      for (const [a, b] of edges) {
        const pa = points[a];
        const pb = points[b];
        if (!pa || !pb) continue;
        linePositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }

    const stars = new THREE.BufferGeometry();
    stars.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );

    const lines = new THREE.BufferGeometry();
    lines.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePositions, 3),
    );

    return { stars, lines };
  }, []);

  return (
    <group>
      <lineSegments geometry={data.lines} frustumCulled={false}>
        <lineBasicMaterial
          color="#c8d8ec"
          transparent
          opacity={0.42}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <points geometry={data.stars} frustumCulled={false}>
        <pointsMaterial
          color="#eef4ff"
          size={1.15}
          sizeAttenuation
          transparent
          opacity={0.92}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
