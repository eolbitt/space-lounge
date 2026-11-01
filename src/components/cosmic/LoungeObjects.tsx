"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { BlackHoleBody, SunBody } from "./CelestialBodies";

/**
 * Asteroid Rest seats — scattered across the lounge (avoid spawn clustering).
 * Keep ≥ ~8 units apart from main pod / each other where practical.
 */
export const ASTEROID_SPOTS: [number, number, number, number][] = [
  [22, -1.2, 14, 1.2],
  [-28, 2.0, 10, 1.05],
  [30, 4.5, -8, 0.95],
  [-24, -2.0, -18, 1.15],
  [8, 8.5, 18, 0.85],
  [-10, 10, -26, 1.0],
  [26, -3.5, -22, 1.1],
  [-32, 5.5, -4, 0.8],
  [14, 12, -2, 0.75],
  [-18, -4, 18, 1.2],
  [32, 1.5, 6, 0.9],
  [-6, 14, 8, 0.7],
  [4, -4.5, 20, 1.05],
  [-30, 8, -22, 0.95],
  [18, 6, -28, 1.0],
  [-14, -3, -28, 1.1],
  [28, 10, 16, 0.8],
  [-22, 12, 4, 0.85],
  [10, -5, -10, 1.15],
  [-4, 2, 24, 0.9],
  [20, -2, 2, 0.75],
  [-26, -1, -10, 1.0],
  [6, 15, -16, 0.7],
  [-16, 7, 20, 0.95],
  [24, 3, -16, 0.85],
  [-8, -5, 6, 1.05],
  [12, 1, -22, 0.9],
  [-20, 4, -6, 0.8],
];

/** Mini lounge pods — wide scatter, not hugging the main pod */
export const REST_PODS: [number, number, number, number][] = [
  [20, 1.2, -20, 2.0],
  [-26, 0.8, 12, 2.2],
  [28, 2.5, 8, 1.85],
  [-18, 3.0, -24, 2.1],
  [12, 6.5, 22, 1.9],
  [-30, 1.0, -14, 2.0],
  [8, -2.5, -28, 1.8],
  [-12, 8.0, 16, 1.95],
];

/** Main lounge pod — offset from spawn so the center stays open */
export const POD_POS: [number, number, number, number] = [16, 0.6, -14, 3.4];

export const EARTH_POS = new THREE.Vector3(2, -9, -16);
/** Mid-ground companions — Earth hemisphere, flaggable */
export const MOON_POS = new THREE.Vector3(24, 6, -30);
export const PLANET_POS = new THREE.Vector3(-26, 8, -34);
/** Flaggable mid-far aliens (also used as sky dressing) */
export const ALIEN_ICE_POS = new THREE.Vector3(18, 10, -48);
export const ALIEN_GAS_POS = new THREE.Vector3(-22, 6, -52);
export const ALIEN_RED_POS = new THREE.Vector3(30, -2, -40);
/**
 * Distant sky dressing — scatter duplicates toward the sun hemisphere
 * and above/below the Earth↔Sun corridor (see planet-scatter-ref).
 */
const DISTANT_BODIES: {
  tex: "ice" | "red" | "gas" | "dwarf" | "star" | "nebula" | "moon" | "planet";
  pos: [number, number, number];
  size: number;
}[] = [
  // ——— Earth-forward (−Z) — thinner, less duplicate clutter ———
  { tex: "ice", pos: [28, 18, -68], size: 9 },
  { tex: "gas", pos: [-36, 4, -72], size: 12 },
  { tex: "red", pos: [48, -12, -55], size: 7 },
  { tex: "moon", pos: [-20, 20, -58], size: 3.8 },
  { tex: "dwarf", pos: [12, -18, -64], size: 4.5 },
  // ——— flanks ———
  { tex: "ice", pos: [-78, 8, -8], size: 9 },
  { tex: "red", pos: [74, 14, -18], size: 7.5 },
  { tex: "gas", pos: [-68, -18, 12], size: 11 },
  { tex: "moon", pos: [62, -16, 6], size: 4 },
  { tex: "dwarf", pos: [-55, 26, 8], size: 4.2 },
  // ——— SUN-SIDE scatter (+Y / +Z toward sun ≈ -26,117,208) ———
  { tex: "planet", pos: [22, 42, 55], size: 8 },
  { tex: "planet", pos: [-38, 58, 70], size: 7 },
  { tex: "planet", pos: [8, 78, 95], size: 6.5 },
  { tex: "planet", pos: [-18, 36, 48], size: 5.8 },
  { tex: "gas", pos: [40, 55, 80], size: 10 },
  { tex: "gas", pos: [-50, 70, 100], size: 9 },
  { tex: "ice", pos: [55, 48, 62], size: 8 },
  { tex: "ice", pos: [-12, 88, 110], size: 7 },
  { tex: "red", pos: [30, 65, 88], size: 6 },
  { tex: "red", pos: [-45, 40, 58], size: 5.5 },
  { tex: "moon", pos: [15, 50, 72], size: 3.6 },
  { tex: "moon", pos: [-28, 72, 90], size: 3.2 },
  { tex: "dwarf", pos: [48, 32, 44], size: 4 },
  { tex: "dwarf", pos: [-8, 95, 120], size: 3.5 },
  // ——— Earth↔Sun corridor ABOVE ———
  { tex: "planet", pos: [-6, 48, 18], size: 6.2 },
  { tex: "gas", pos: [18, 38, 8], size: 7.5 },
  { tex: "ice", pos: [-24, 55, 28], size: 6 },
  { tex: "moon", pos: [10, 44, -4], size: 3.4 },
  { tex: "red", pos: [-14, 62, 40], size: 5 },
  { tex: "dwarf", pos: [26, 50, 22], size: 3 },
  // ——— Earth↔Sun corridor BELOW ———
  { tex: "planet", pos: [12, -38, 20], size: 6 },
  { tex: "gas", pos: [-22, -45, 32], size: 8 },
  { tex: "ice", pos: [30, -32, 8], size: 5.5 },
  { tex: "moon", pos: [-8, -50, 42], size: 3.5 },
  { tex: "red", pos: [5, -28, 50], size: 5.2 },
  { tex: "dwarf", pos: [-32, -36, 14], size: 3.2 },
  // ——— nebulae / stars (atmosphere, not planet dupes) ———
  { tex: "nebula", pos: [40, 30, 75], size: 38 },
  { tex: "nebula", pos: [-55, 50, 90], size: 42 },
  { tex: "nebula", pos: [15, -40, 60], size: 34 },
  { tex: "nebula", pos: [-30, 20, -55], size: 36 },
  { tex: "nebula", pos: [60, -20, 40], size: 30 },
  { tex: "star", pos: [20, 60, 70], size: 4.5 },
  { tex: "star", pos: [-30, 80, 100], size: 4.0 },
  { tex: "star", pos: [45, 25, 50], size: 3.6 },
  { tex: "star", pos: [-15, -35, 45], size: 3.8 },
  { tex: "star", pos: [8, 40, -50], size: 5.0 },
  { tex: "star", pos: [-40, 10, -40], size: 4.2 },
  { tex: "star", pos: [55, 70, 85], size: 3.4 },
  { tex: "star", pos: [-60, -15, 55], size: 3.2 },
  // ——— far top / bottom parallax (sparse) ———
  { tex: "ice", pos: [-40, 110, 40], size: 3.8 },
  { tex: "red", pos: [50, 100, 60], size: 3.2 },
  { tex: "planet", pos: [10, 125, 80], size: 3.5 },
  { tex: "gas", pos: [-25, -95, 35], size: 4.2 },
  { tex: "moon", pos: [35, -85, 50], size: 2.6 },
  { tex: "dwarf", pos: [-55, -70, 20], size: 2.4 },
];

/** Counter-roll so ringed `planet.png` (baked ~35° tilt) reads upright. */
const RING_UPRIGHT_ROLL = 0.62;

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
  /** Screen-space roll (rad) — used to upright tilted ring textures */
  roll = 0,
  scaleY = 1,
}: {
  map: THREE.Texture;
  position: [number, number, number];
  size: number;
  renderOrder?: number;
  opacity?: number;
  additive?: boolean;
  alphaTest?: number;
  depthWrite?: boolean;
  roll?: number;
  scaleY?: number;
}) {
  return (
    <Billboard follow position={position}>
      <mesh
        renderOrder={renderOrder}
        scale={[size, size * scaleY, 1]}
        rotation={[0, 0, roll]}
      >
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
    // Keep ringed planets upright — no tilt wobble on planetGroup
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

      <group ref={planetGroup} position={[PLANET_POS.x, PLANET_POS.y, PLANET_POS.z]}>
        <CelestialBillboard
          map={planet}
          position={[0, 0, 0]}
          size={8.5}
          scaleY={0.52}
          roll={RING_UPRIGHT_ROLL}
          alphaTest={0.12}
          depthWrite
        />
      </group>

      {/* Flaggable mid-far aliens */}
      <CelestialBillboard
        map={ice}
        position={[ALIEN_ICE_POS.x, ALIEN_ICE_POS.y, ALIEN_ICE_POS.z]}
        size={10}
        alphaTest={0.12}
        depthWrite
      />
      <CelestialBillboard
        map={gas}
        position={[ALIEN_GAS_POS.x, ALIEN_GAS_POS.y, ALIEN_GAS_POS.z]}
        size={12}
        alphaTest={0.12}
        depthWrite
      />
      <CelestialBillboard
        map={red}
        position={[ALIEN_RED_POS.x, ALIEN_RED_POS.y, ALIEN_RED_POS.z]}
        size={7}
        alphaTest={0.12}
        depthWrite
      />

      {/* Distant deep-space dressing */}
      <group ref={distantGroup}>
        {DISTANT_BODIES.map((b, i) => (
          <CelestialBillboard
            key={`sky-${i}`}
            map={texFor(b.tex)}
            position={b.pos}
            size={b.size}
            roll={b.tex === "planet" ? RING_UPRIGHT_ROLL : 0}
            scaleY={b.tex === "planet" ? 0.52 : 1}
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
