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
  // denser Rest ring — fills empty mid-vista seats
  [-0.8, 0.6, -7.5, 1.0],
  [6.2, 0.9, -11.2, 0.9],
  [-6.8, -0.4, -8.8, 1.05],
  [2.0, 3.6, -5.2, 0.72],
  [-15.5, 2.8, -9.5, 0.85],
  [18.2, -0.5, -7.0, 0.8],
  [-3.8, -2.2, 4.5, 1.0],
  [10.5, 4.2, -3.5, 0.7],
  [-9.5, 1.2, -20.5, 1.1],
  [15.8, -1.8, 8.5, 0.95],
  [0.2, 5.5, -12.0, 0.68],
  [-20.5, 1.5, -6.0, 0.78],
];

/** Extra warm rest pods (mini lounge seats) — atmosphere only */
export const REST_PODS: [number, number, number, number][] = [
  [4.2, 0.3, 5.8, 2.1],
  [-11.5, 0.6, -2.5, 2.4],
  [9.8, -0.2, -8.5, 1.9],
  [-3.5, 1.4, -6.8, 2.0],
  [14.2, 1.0, 2.5, 1.85],
  // more mini pods across mid-space
  [-1.8, 0.2, -12.5, 2.0],
  [7.5, 2.2, -15.5, 1.75],
  [-16.2, -0.3, 5.5, 2.15],
  [19.5, 0.8, -4.5, 1.8],
  [1.2, 3.0, 11.5, 1.7],
];

/** Warm lounge pod — atmosphere / Rest perch (no landing mission). */
export const POD_POS: [number, number, number, number] = [-6.5, 0.4, 4.2, 3.4];

export const EARTH_POS = new THREE.Vector3(2, -9, -16);
/** Mid-ground companions — kept in Earth hemisphere (−Z), away from sun limb */
export const MOON_POS = new THREE.Vector3(28, 8, -38);
export const PLANET_POS = new THREE.Vector3(-32, 10, -44);

/**
 * Distant sky dressing — fills empty deep-space vistas.
 * Avoid the sun cone (+Y/+Z opposite Earth) so planets never stick to the sun limb.
 * Top/bottom far aliens are tiny parallax markers.
 */
const DISTANT_BODIES: {
  tex: "ice" | "red" | "gas" | "dwarf" | "star" | "nebula" | "moon" | "planet";
  pos: [number, number, number];
  size: number;
}[] = [
  // ——— forward empty vista (−Z, Earth side) ———
  { tex: "ice", pos: [18, 14, -62], size: 12 },
  { tex: "gas", pos: [-28, 8, -70], size: 15 },
  { tex: "red", pos: [42, -6, -58], size: 8 },
  { tex: "planet", pos: [-8, 22, -75], size: 9 },
  { tex: "moon", pos: [32, 18, -48], size: 4.5 },
  { tex: "dwarf", pos: [-38, -4, -52], size: 5.5 },
  { tex: "ice", pos: [8, -16, -68], size: 7 },
  { tex: "red", pos: [-48, 16, -40], size: 6.8 },
  { tex: "gas", pos: [55, 12, -45], size: 11 },
  { tex: "dwarf", pos: [-12, 28, -55], size: 4.8 },
  { tex: "moon", pos: [5, 6, -80], size: 3.8 },
  { tex: "planet", pos: [-55, -10, -48], size: 7.2 },
  // ——— left / right flanks (not toward sun) ———
  { tex: "ice", pos: [-72, 12, -18], size: 10 },
  { tex: "red", pos: [68, 6, -22], size: 8.5 },
  { tex: "gas", pos: [-60, -14, -8], size: 12 },
  { tex: "planet", pos: [65, -12, -14], size: 7 },
  { tex: "moon", pos: [-50, 22, -12], size: 4.2 },
  { tex: "dwarf", pos: [58, 20, -18], size: 5 },
  { tex: "ice", pos: [-45, -18, -28], size: 6.5 },
  { tex: "red", pos: [48, 24, -10], size: 6 },
  // ——— behind (+Z) sky ONLY far off the sun axis (no ice/moon/planet on sun limb) ———
  { tex: "nebula", pos: [70, -25, 90], size: 34 },
  { tex: "nebula", pos: [-75, -30, 85], size: 30 },
  { tex: "star", pos: [80, 5, 70], size: 3.2 },
  { tex: "star", pos: [-85, -8, 65], size: 2.8 },
  { tex: "dwarf", pos: [90, -40, 55], size: 3.5 },
  { tex: "dwarf", pos: [-88, 35, 60], size: 3.2 },
  // ——— bright stars ———
  { tex: "star", pos: [22, 20, -55], size: 5.5 },
  { tex: "star", pos: [-30, 14, -60], size: 4.8 },
  { tex: "star", pos: [8, -10, -72], size: 6.2 },
  { tex: "star", pos: [-55, 8, -30], size: 4.2 },
  { tex: "star", pos: [50, 16, -35], size: 5.0 },
  { tex: "star", pos: [-18, 32, -40], size: 3.8 },
  { tex: "star", pos: [35, -14, -50], size: 4.5 },
  { tex: "star", pos: [60, 5, -25], size: 3.6 },
  { tex: "star", pos: [-65, -5, -20], size: 4.4 },
  { tex: "star", pos: [15, 40, -45], size: 3.5 },
  { tex: "star", pos: [-40, -20, -45], size: 3.9 },
  // ——— nebula patches (Earth hemisphere) ———
  { tex: "nebula", pos: [20, 16, -65], size: 36 },
  { tex: "nebula", pos: [-35, 12, -58], size: 40 },
  { tex: "nebula", pos: [5, 28, -48], size: 32 },
  { tex: "nebula", pos: [48, 8, -30], size: 28 },
  { tex: "nebula", pos: [-50, 6, -25], size: 30 },
  // ——— mid-far layer ———
  { tex: "dwarf", pos: [14, 9, -26], size: 3.2 },
  { tex: "dwarf", pos: [-11, 11, -24], size: 2.8 },
  { tex: "moon", pos: [9, 16, -32], size: 3.0 },
  { tex: "red", pos: [-16, 7, -34], size: 4.5 },
  { tex: "ice", pos: [21, 4, -36], size: 5.0 },
  { tex: "dwarf", pos: [3, 14, -28], size: 2.4 },
  { tex: "moon", pos: [-22, 13, -30], size: 2.6 },
  { tex: "planet", pos: [28, -3, -38], size: 5.5 },
  { tex: "gas", pos: [-6, 19, -42], size: 6.5 },
  { tex: "star", pos: [16, 12, -30], size: 3.2 },
  { tex: "star", pos: [-14, 15, -33], size: 2.8 },
  { tex: "star", pos: [6, 8, -40], size: 3.6 },
  { tex: "star", pos: [-25, 5, -36], size: 2.6 },
  { tex: "dwarf", pos: [17, -5, -22], size: 2.2 },
  { tex: "moon", pos: [-8, -6, -30], size: 2.5 },
  // ——— TOP empty void — far alien worlds (small parallax markers) ———
  { tex: "ice", pos: [-35, 95, -40], size: 4.2 },
  { tex: "red", pos: [48, 110, -20], size: 3.4 },
  { tex: "gas", pos: [12, 88, 30], size: 5.0 },
  { tex: "planet", pos: [-60, 102, 15], size: 3.8 },
  { tex: "dwarf", pos: [70, 78, -55], size: 2.8 },
  { tex: "moon", pos: [-15, 120, -5], size: 2.6 },
  { tex: "ice", pos: [30, 85, -70], size: 3.6 },
  { tex: "red", pos: [-80, 92, -35], size: 3.2 },
  { tex: "planet", pos: [5, 105, 45], size: 3.5 },
  { tex: "gas", pos: [55, 130, -40], size: 4.6 },
  { tex: "dwarf", pos: [-45, 140, -25], size: 2.4 },
  { tex: "moon", pos: [90, 100, -50], size: 2.2 },
  // ——— BOTTOM empty void — far alien worlds ———
  { tex: "red", pos: [40, -70, -35], size: 4.0 },
  { tex: "ice", pos: [-50, -85, -15], size: 3.6 },
  { tex: "planet", pos: [15, -95, 25], size: 4.4 },
  { tex: "gas", pos: [-25, -78, -50], size: 4.8 },
  { tex: "dwarf", pos: [65, -60, -20], size: 2.6 },
  { tex: "moon", pos: [-70, -88, 10], size: 3.0 },
  { tex: "ice", pos: [8, -110, -30], size: 3.8 },
  { tex: "red", pos: [-40, -65, 40], size: 3.4 },
  { tex: "planet", pos: [75, -90, -45], size: 4.0 },
  { tex: "gas", pos: [-10, -100, -60], size: 4.2 },
  { tex: "dwarf", pos: [50, -120, 5], size: 2.5 },
  { tex: "moon", pos: [-90, -75, -40], size: 2.8 },
];

function CelestialBillboard({
  map,
  position,
  size,
  renderOrder = 2,
  opacity = 1,
  additive = false,
  /** Discard soft alpha so hollow sprites don't punch black holes into the sun */
  alphaTest = 0.15,
  depthWrite = true,
}: {
  map: THREE.Texture;
  position: [number, number, number];
  size: number;
  renderOrder?: number;
  opacity?: number;
  additive?: boolean;
  alphaTest?: number;
  depthWrite?: boolean;
}) {
  return (
    <Billboard follow position={position}>
      <mesh renderOrder={renderOrder} scale={[size, size, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={map}
          transparent={!additive}
          opacity={opacity}
          alphaTest={additive ? 0 : alphaTest}
          depthWrite={depthWrite}
          depthTest
          toneMapped={false}
          side={THREE.DoubleSide}
          blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
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
            renderOrder={b.tex === "nebula" ? 0 : b.tex === "star" ? 2 : 1}
            opacity={
              b.tex === "nebula" ? 0.5 : b.tex === "star" ? 0.95 : 0.96
            }
            additive={b.tex === "star"}
            alphaTest={b.tex === "nebula" ? 0.02 : 0.12}
            depthWrite={b.tex !== "nebula" && b.tex !== "star"}
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
            alphaTest={0.45}
            depthWrite
          />
          <mesh
            rotation={[0.4 + i * 0.2, 0.6 + i * 0.15, 0.1]}
            scale={s * 0.28}
            position={[0, -0.05, 0.05]}
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
