"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { BlackHoleBody, SunBody } from "./CelestialBodies";
import { SpaceMotion } from "./SpaceMotion";
import {
  EARTH_POS,
  MOON_POS,
  getSolarPlanets,
  type SolarPlanet,
} from "@/lib/solarSystem";

export { EARTH_POS, MOON_POS };

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

/** Counter-roll so ringed `planet.png` (baked ~35° tilt) reads upright. */
const RING_UPRIGHT_ROLL = 0.62;

/** Sparse atmosphere only — no duplicate planet/star clutter. */
const SKY_DRESSING: {
  tex: "nebula" | "star";
  pos: [number, number, number];
  size: number;
}[] = [
  { tex: "nebula", pos: [48, 28, 70], size: 36 },
  { tex: "nebula", pos: [-62, 40, 88], size: 40 },
  { tex: "nebula", pos: [20, -36, -58], size: 32 },
  { tex: "star", pos: [30, 55, 65], size: 3.8 },
  { tex: "star", pos: [-40, 70, 90], size: 3.4 },
  { tex: "star", pos: [12, -28, -48], size: 3.2 },
];

function CelestialBillboard({
  map,
  position,
  size,
  renderOrder = 2,
  opacity = 1,
  additive = false,
  alphaTest = 0.15,
  depthWrite = true,
  roll = 0,
  scaleY = 1,
  color,
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
  color?: string;
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
          color={color ?? "#ffffff"}
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

function SolarPlanetSprite({
  planet,
  map,
}: {
  planet: SolarPlanet;
  map: THREE.Texture;
}) {
  const ringed = Boolean(planet.ringed);
  // Planet sprite only — no aura / circular backplate discs
  return (
    <group position={[planet.pos.x, planet.pos.y, planet.pos.z]}>
      <CelestialBillboard
        map={map}
        position={[0, 0, 0]}
        size={planet.size}
        scaleY={ringed ? 0.52 : 1}
        roll={ringed ? RING_UPRIGHT_ROLL : 0}
        color={planet.color}
        // Hard cut — discard soft/dark PNG limb fringe against the sun
        alphaTest={0.45}
        depthWrite
      />
    </group>
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
  const planets = useMemo(() => getSolarPlanets(), []);
  const asteroids = useMemo(() => ASTEROID_SPOTS, []);
  const restPods = useMemo(() => REST_PODS, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (moonGroup.current) {
      moonGroup.current.position.y = MOON_POS.y + Math.sin(t * 0.18) * 0.2;
    }
  });

  const texFor = (key: SolarPlanet["tex"]) => maps[key];

  return (
    <group>
      <SunBody />
      <BlackHoleBody />

      {planets.map((p) => (
        <SolarPlanetSprite key={p.id} planet={p} map={texFor(p.tex)} />
      ))}

      <group ref={moonGroup} position={[MOON_POS.x, MOON_POS.y, MOON_POS.z]}>
        <CelestialBillboard map={moon} position={[0, 0, 0]} size={4.2} />
      </group>

      {/* Sparse nebulae / distant stars — atmosphere only */}
      {SKY_DRESSING.map((b, i) => (
        <CelestialBillboard
          key={`sky-${i}`}
          map={b.tex === "nebula" ? nebula : star}
          position={b.pos}
          size={b.size}
          renderOrder={b.tex === "nebula" ? 0 : 2}
          opacity={b.tex === "nebula" ? 0.48 : 0.9}
          additive={b.tex === "star"}
          alphaTest={b.tex === "nebula" ? 0.02 : 0.12}
          depthWrite={false}
        />
      ))}

      <SpaceMotion />

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

      {/* Rest-seat asteroids (static perches) */}
      {asteroids.map(([x, y, z, s], i) => (
        <group key={`rest-rock-${i}`} position={[x, y, z]}>
          <CelestialBillboard
            map={asteroid}
            position={[0, 0, 0]}
            size={s * 1.15}
            renderOrder={3}
            alphaTest={0.5}
            depthWrite
          />
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
