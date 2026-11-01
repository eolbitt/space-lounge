"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/** Spread across a wide lounge so drift between bodies feels real. */
export const ASTEROID_SPOTS: [number, number, number, number][] = [
  // x, y, z, scale
  [-8.5, -1.2, 6.5, 1.5],
  [11.2, -0.6, 3.2, 1.05],
  [-14.5, 1.8, -4.5, 0.9],
  [5.5, -1.4, 10.5, 1.25],
  [16.5, 0.8, -2.2, 0.75],
  [-4.2, 2.4, -10.5, 0.85],
  [2.8, -0.8, -14.5, 1.1],
  [-18, -0.2, 2.5, 0.7],
];

export const LOOK_AT_EARTH = new THREE.Vector3(1.5, -8, -10);

function SpritePlane({
  map,
  position,
  scale,
  opacity = 1,
  renderOrder = 1,
}: {
  map: THREE.Texture;
  position: [number, number, number];
  scale: [number, number, number] | number;
  opacity?: number;
  renderOrder?: number;
}) {
  const s = typeof scale === "number" ? ([scale, scale, 1] as const) : scale;
  return (
    <mesh position={position} scale={s} renderOrder={renderOrder}>
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
  );
}

/** Earth centerpiece; moon & ringed planet far enough to travel toward. */
export function LoungeObjects() {
  const [earth, moon, planet, asteroid] = useTexture([
    "/assets/objects/earth.png",
    "/assets/objects/moon.png",
    "/assets/objects/planet.png",
    "/assets/objects/asteroid.png",
  ]) as THREE.Texture[];

  for (const t of [earth, moon, planet, asteroid]) {
    t.colorSpace = THREE.SRGBColorSpace;
  }

  const planetRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (planetRef.current) {
      planetRef.current.rotation.z = Math.sin(t * 0.05) * 0.04;
    }
    if (moonRef.current) {
      moonRef.current.position.y = 9.5 + Math.sin(t * 0.18) * 0.12;
    }
  });

  const asteroids = useMemo(() => ASTEROID_SPOTS, []);

  return (
    <group>
      <SpritePlane
        map={earth}
        position={[1.5, -10.5, -10]}
        scale={[22, 22, 1]}
        renderOrder={2}
      />

      <group ref={moonRef} position={[18, 9.5, -20]}>
        <SpritePlane map={moon} position={[0, 0, 0]} scale={5.2} renderOrder={2} />
      </group>

      <mesh
        ref={planetRef}
        position={[-20, 10.5, -22]}
        scale={[7.2, 3.7, 1]}
        renderOrder={2}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={planet}
          transparent
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {asteroids.map(([x, y, z, s], i) => (
        <SpritePlane
          key={i}
          map={asteroid}
          position={[x, y, z]}
          scale={s}
          opacity={0.98}
          renderOrder={3}
        />
      ))}
    </group>
  );
}

export function nearestAsteroid(
  pos: THREE.Vector3,
): { spot: [number, number, number, number]; dist: number } | null {
  let best: { spot: [number, number, number, number]; dist: number } | null =
    null;
  for (const spot of ASTEROID_SPOTS) {
    const d = pos.distanceTo(
      new THREE.Vector3(spot[0], spot[1] + 0.55, spot[2]),
    );
    if (!best || d < best.dist) best = { spot, dist: d };
  }
  return best;
}
