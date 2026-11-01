"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { BlackHoleBody, SunBody } from "./CelestialBodies";

/** [x, y, z, scale] — reachable Rest perches in the lounge volume */
export const ASTEROID_SPOTS: [number, number, number, number][] = [
  [-8.5, -1.2, 6.5, 1.5],
  [11.2, -0.6, 3.2, 1.05],
  [-14.5, 1.8, -4.5, 0.9],
  [5.5, -1.4, 10.5, 1.25],
  [16.5, 0.8, -2.2, 0.75],
  [-4.2, 2.4, -10.5, 0.85],
  [2.8, -0.8, -14.5, 1.1],
  [-18, -0.2, 2.5, 0.7],
  [8.5, 3.2, -18, 0.95],
  [-10, -2.5, -16, 1.15],
  // nearer cluster around spawn / empty mid-space
  [1.8, 0.2, 3.4, 0.95],
  [-2.4, 1.1, 1.2, 0.85],
  [4.6, -0.3, 0.4, 1.05],
  [-5.2, -0.8, 8.2, 1.2],
  [7.4, 1.6, 7.8, 0.8],
  [-1.1, 2.8, 5.5, 0.7],
  [9.2, -1.5, -6.5, 1.1],
  [-12.2, 0.6, 9.5, 0.95],
  [0.4, -1.8, -3.2, 1.15],
  [13.5, 2.2, 5.0, 0.75],
  [-7.8, 3.5, -1.5, 0.88],
  [3.2, 4.0, 9.0, 0.7],
];

/** Extra warm rest pods (mini lounge seats) — atmosphere only */
export const REST_PODS: [number, number, number, number][] = [
  [4.2, 0.3, 5.8, 2.1],
  [-11.5, 0.6, -2.5, 2.4],
  [9.8, -0.2, -8.5, 1.9],
  [-3.5, 1.4, -6.8, 2.0],
  [14.2, 1.0, 2.5, 1.85],
];

/** Warm lounge pod — atmosphere / Rest perch (no landing mission). */
export const POD_POS: [number, number, number, number] = [-6.5, 0.4, 4.2, 3.4];

export const EARTH_POS = new THREE.Vector3(2, -9, -16);
export const MOON_POS = new THREE.Vector3(22, 10, -28);
export const PLANET_POS = new THREE.Vector3(-24, 12, -30);

/** Distant sky dressing — fills empty deep-space vistas (far from play volume). */
const DISTANT_BODIES: {
  tex: "ice" | "red" | "gas" | "dwarf" | "star" | "nebula" | "moon" | "planet";
  pos: [number, number, number];
  size: number;
}[] = [
  { tex: "ice", pos: [48, 22, 35], size: 11 },
  { tex: "red", pos: [-55, 8, 42], size: 9 },
  { tex: "gas", pos: [38, -18, 55], size: 14 },
  { tex: "dwarf", pos: [-28, 28, 48], size: 4.2 },
  { tex: "dwarf", pos: [62, 5, -20], size: 3.6 },
  { tex: "moon", pos: [-40, -12, 58], size: 3.2 },
  { tex: "planet", pos: [20, 32, 70], size: 7.5 },
  { tex: "ice", pos: [-70, 18, -25], size: 8 },
  { tex: "red", pos: [55, -22, -40], size: 6.5 },
  { tex: "gas", pos: [-15, 40, -55], size: 12 },
  { tex: "star", pos: [25, 18, 40], size: 2.8 },
  { tex: "star", pos: [-32, 12, 30], size: 2.2 },
  { tex: "star", pos: [12, -8, 52], size: 3.4 },
  { tex: "star", pos: [-50, 25, 15], size: 1.9 },
  { tex: "star", pos: [45, 8, -50], size: 2.5 },
  { tex: "star", pos: [-8, 30, 25], size: 2.0 },
  { tex: "nebula", pos: [30, 15, 45], size: 28 },
  { tex: "nebula", pos: [-45, 10, 38], size: 32 },
  { tex: "nebula", pos: [5, 25, 60], size: 24 },
  { tex: "dwarf", pos: [18, -14, 38], size: 2.8 },
  { tex: "ice", pos: [-22, -20, 65], size: 5.5 },
  { tex: "moon", pos: [70, 16, 10], size: 4.0 },
];

function CelestialBillboard({
  map,
  position,
  size,
  renderOrder = 2,
  opacity = 1,
}: {
  map: THREE.Texture;
  position: [number, number, number];
  size: number;
  renderOrder?: number;
  opacity?: number;
}) {
  return (
    <Billboard follow position={position}>
      <mesh renderOrder={renderOrder} scale={[size, size, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={map}
          transparent
          opacity={opacity}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}

/** Celestial bodies + lounge pod in a real 3D volume. */
export function LoungeObjects() {
  const [earth, moon, planet, asteroid, pod, ice, red, gas, dwarf, star, nebula] =
    useTexture([
      "/assets/objects/earth.png",
      "/assets/objects/moon.png",
      "/assets/objects/planet.png",
      "/assets/objects/asteroid.png",
      "/assets/objects/lounge-pod.png",
      "/assets/objects/planet-ice.png",
      "/assets/objects/planet-red.png",
      "/assets/objects/planet-gas.png",
      "/assets/objects/planet-dwarf.png",
      "/assets/objects/star-distant.png",
      "/assets/objects/nebula-patch.png",
    ]) as THREE.Texture[];

  const maps = {
    earth,
    moon,
    planet,
    asteroid,
    pod,
    ice,
    red,
    gas,
    dwarf,
    star,
    nebula,
  };

  for (const t of Object.values(maps)) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  }

  const moonGroup = useRef<THREE.Group>(null);
  const planetGroup = useRef<THREE.Group>(null);
  const distantGroup = useRef<THREE.Group>(null);
  const asteroids = useMemo(() => ASTEROID_SPOTS, []);
  const restPods = useMemo(() => REST_PODS, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (moonGroup.current) {
      moonGroup.current.position.y = MOON_POS.y + Math.sin(t * 0.18) * 0.2;
    }
    if (planetGroup.current) {
      planetGroup.current.rotation.z = Math.sin(t * 0.05) * 0.05;
    }
    if (distantGroup.current) {
      distantGroup.current.rotation.y = Math.sin(t * 0.015) * 0.02;
    }
  });

  const texFor = (key: (typeof DISTANT_BODIES)[number]["tex"]) => {
    switch (key) {
      case "ice":
        return ice;
      case "red":
        return red;
      case "gas":
        return gas;
      case "dwarf":
        return dwarf;
      case "star":
        return star;
      case "nebula":
        return nebula;
      case "moon":
        return moon;
      case "planet":
        return planet;
    }
  };

  return (
    <group>
      <CelestialBillboard
        map={earth}
        position={[EARTH_POS.x, EARTH_POS.y, EARTH_POS.z]}
        size={18}
      />

      <SunBody />
      <BlackHoleBody />

      <group ref={moonGroup} position={[MOON_POS.x, MOON_POS.y, MOON_POS.z]}>
        <CelestialBillboard map={moon} position={[0, 0, 0]} size={4.8} />
      </group>

      <group
        ref={planetGroup}
        position={[PLANET_POS.x, PLANET_POS.y, PLANET_POS.z]}
      >
        <Billboard follow>
          <mesh scale={[8.5, 4.4, 1]} renderOrder={2}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={planet}
              transparent
              depthWrite={false}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </Billboard>
      </group>

      {/* Distant deep-space dressing */}
      <group ref={distantGroup}>
        {DISTANT_BODIES.map((b, i) => (
          <CelestialBillboard
            key={`sky-${i}`}
            map={texFor(b.tex)}
            position={b.pos}
            size={b.size}
            renderOrder={b.tex === "nebula" ? 0 : 1}
            opacity={b.tex === "nebula" ? 0.55 : b.tex === "star" ? 0.9 : 0.95}
          />
        ))}
      </group>

      {/* Main lounge pod */}
      <group position={[POD_POS[0], POD_POS[1], POD_POS[2]]}>
        <CelestialBillboard
          map={pod}
          position={[0, 0, 0]}
          size={POD_POS[3]}
          renderOrder={4}
        />
        <pointLight
          position={[0.4, 0.2, 0.8]}
          intensity={1.4}
          distance={8}
          color="#ffc978"
        />
        <pointLight
          position={[-0.3, 0.1, 0.5]}
          intensity={0.45}
          distance={5}
          color="#ffebc0"
        />
      </group>

      {/* Extra rest pods */}
      {restPods.map(([x, y, z, s], i) => (
        <group key={`rest-pod-${i}`} position={[x, y, z]}>
          <CelestialBillboard
            map={pod}
            position={[0, 0, 0]}
            size={s}
            renderOrder={4}
            opacity={0.92}
          />
          <pointLight
            position={[0.2, 0.15, 0.5]}
            intensity={0.7}
            distance={5}
            color="#ffc978"
          />
        </group>
      ))}

      {asteroids.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]}>
          <CelestialBillboard
            map={asteroid}
            position={[0, 0, 0]}
            size={s * 1.15}
            renderOrder={3}
          />
          <mesh
            rotation={[0.4 + i * 0.2, 0.6 + i * 0.15, 0.1]}
            scale={s * 0.35}
          >
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color="#3a3a40"
              roughness={0.95}
              metalness={0.05}
              flatShading
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export type RestSpot = {
  spot: [number, number, number, number];
  dist: number;
  kind: "asteroid" | "pod";
};

/** Prefer lounge pod when nearby; otherwise nearest asteroid / rest pod. */
export function nearestRestSpot(pos: THREE.Vector3): RestSpot | null {
  let best: RestSpot | null = null;

  const considerPod = (
    px: number,
    py: number,
    pz: number,
    scale: number,
    offset: [number, number, number] = [1.0, -0.15, 1.2],
  ) => {
    const perch = new THREE.Vector3(
      px + offset[0],
      py + offset[1],
      pz + offset[2],
    );
    const dist = pos.distanceTo(perch);
    const spot: RestSpot = {
      spot: [perch.x, perch.y - 0.35, perch.z, scale],
      dist,
      kind: "pod",
    };
    if (!best || dist < best.dist) best = spot;
  };

  considerPod(POD_POS[0], POD_POS[1], POD_POS[2], POD_POS[3], [
    1.1,
    -0.15,
    1.35,
  ]);
  for (const [x, y, z, s] of REST_PODS) {
    considerPod(x, y, z, s);
  }

  for (const spot of ASTEROID_SPOTS) {
    const d = pos.distanceTo(
      new THREE.Vector3(spot[0], spot[1] + 0.55, spot[2]),
    );
    if (!best || d < best.dist) {
      best = { spot, dist: d, kind: "asteroid" };
    }
  }
  return best;
}

/** @deprecated use nearestRestSpot */
export function nearestAsteroid(pos: THREE.Vector3) {
  const r = nearestRestSpot(pos);
  if (!r) return null;
  return { spot: r.spot, dist: r.dist };
}
