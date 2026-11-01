"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";

/** [x, y, z, scale] — spread in true 3D volume */
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
];

/** Warm lounge pod — atmosphere / Rest perch (no landing mission). */
export const POD_POS: [number, number, number, number] = [-6.5, 0.4, 4.2, 3.4];

export const EARTH_POS = new THREE.Vector3(2, -9, -16);
export const MOON_POS = new THREE.Vector3(22, 10, -28);
export const PLANET_POS = new THREE.Vector3(-24, 12, -30);
/** Warm sun — ~10× avatar scale, far atmospheric light. */
export const SUN_POS = new THREE.Vector3(26, 16, -22);
export const SUN_SIZE = 5.5;

function CelestialBillboard({
  map,
  position,
  size,
  renderOrder = 2,
}: {
  map: THREE.Texture;
  position: [number, number, number];
  size: number;
  renderOrder?: number;
}) {
  return (
    <Billboard follow position={position}>
      <mesh renderOrder={renderOrder} scale={[size, size, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={map}
          transparent
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
  const [earth, moon, planet, asteroid, pod, sun] = useTexture([
    "/assets/objects/earth.png",
    "/assets/objects/moon.png",
    "/assets/objects/planet.png",
    "/assets/objects/asteroid.png",
    "/assets/objects/lounge-pod.png",
    "/assets/objects/sun.png",
  ]) as THREE.Texture[];

  for (const t of [earth, moon, planet, asteroid, pod, sun]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  }

  const moonGroup = useRef<THREE.Group>(null);
  const planetGroup = useRef<THREE.Group>(null);
  const sunGroup = useRef<THREE.Group>(null);
  const asteroids = useMemo(() => ASTEROID_SPOTS, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (moonGroup.current) {
      moonGroup.current.position.y = MOON_POS.y + Math.sin(t * 0.18) * 0.2;
    }
    if (planetGroup.current) {
      planetGroup.current.rotation.z = Math.sin(t * 0.05) * 0.05;
    }
    if (sunGroup.current) {
      sunGroup.current.position.y = SUN_POS.y + Math.sin(t * 0.12) * 0.35;
      const pulse = 1 + Math.sin(t * 0.7) * 0.03;
      sunGroup.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <CelestialBillboard
        map={earth}
        position={[EARTH_POS.x, EARTH_POS.y, EARTH_POS.z]}
        size={18}
      />

      <group ref={sunGroup} position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}>
        <CelestialBillboard
          map={sun}
          position={[0, 0, 0]}
          size={SUN_SIZE}
          renderOrder={1}
        />
        <pointLight
          position={[0, 0, 2]}
          intensity={1.1}
          distance={48}
          color="#ffd089"
        />
      </group>

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

      {/* Lounge pod — warm rest atmosphere */}
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

/** Prefer lounge pod when nearby; otherwise nearest asteroid. */
export function nearestRestSpot(pos: THREE.Vector3): RestSpot | null {
  let best: RestSpot | null = null;

  const podPerch = new THREE.Vector3(
    POD_POS[0] + 1.1,
    POD_POS[1] - 0.15,
    POD_POS[2] + 1.35,
  );
  const podDist = pos.distanceTo(podPerch);
  best = {
    spot: [podPerch.x, podPerch.y - 0.45, podPerch.z, POD_POS[3]],
    dist: podDist,
    kind: "pod",
  };

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
