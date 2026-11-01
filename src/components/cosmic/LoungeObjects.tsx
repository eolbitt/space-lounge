"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export const ASTEROID_SPOTS: [number, number, number, number][] = [
  // x, y, z, scale
  [-3.2, -0.9, 3.4, 1.35],
  [4.5, -0.4, 1.2, 0.85],
  [-5.5, 0.6, -1.5, 0.7],
  [2.2, -1.1, 4.8, 1.1],
  [6.8, 0.2, -0.5, 0.55],
];

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

/** Earth as largest centerpiece; moon, ringed planet, asteroids as atmosphere. */
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
      moonRef.current.position.y = 4.2 + Math.sin(t * 0.2) * 0.08;
    }
  });

  const asteroids = useMemo(() => ASTEROID_SPOTS, []);

  return (
    <group>
      {/* Earth — dominant lounge center, bottom of frame */}
      <SpritePlane
        map={earth}
        position={[0.6, -6.8, -6]}
        scale={[16, 16, 1]}
        renderOrder={2}
      />

      {/* Moon — upper right atmosphere */}
      <group ref={moonRef} position={[7.5, 4.2, -12]}>
        <SpritePlane map={moon} position={[0, 0, 0]} scale={3.4} renderOrder={2} />
      </group>

      {/* Ringed planet — upper left atmosphere */}
      <mesh ref={planetRef} position={[-8.5, 4.8, -14]} scale={[4.8, 2.5, 1]} renderOrder={2}>
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
    const d = pos.distanceTo(new THREE.Vector3(spot[0], spot[1] + 0.55, spot[2]));
    if (!best || d < best.dist) best = { spot, dist: d };
  }
  return best;
}
