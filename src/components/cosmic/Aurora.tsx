"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Band = {
  radius: number;
  width: number;
  color: string;
  speed: number;
  phase: number;
  tilt: number;
};

const BANDS: Band[] = [
  { radius: 10.2, width: 1.35, color: "#5dffb0", speed: 0.07, phase: 0.2, tilt: 0.55 },
  { radius: 10.8, width: 1.1, color: "#7affd8", speed: 0.055, phase: 1.4, tilt: 0.62 },
  { radius: 11.4, width: 1.55, color: "#a8ff7a", speed: 0.04, phase: 2.6, tilt: 0.48 },
  { radius: 9.7, width: 0.85, color: "#66e0ff", speed: 0.09, phase: 3.8, tilt: 0.7 },
];

type Props = {
  /** Earth anchor — aurora ribbons orbit this point. */
  position: [number, number, number];
};

/**
 * Soft aurora ribbons that slowly pass over Earth (matches HUD copy).
 * Atmosphere-only — no gameplay.
 */
export function EarthAurora({ position }: Props) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const curtains = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const geos = useMemo(
    () =>
      BANDS.map(
        (b) =>
          new THREE.TorusGeometry(
            b.radius,
            b.width * 0.22,
            10,
            96,
            Math.PI * 1.15,
          ),
      ),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      if (i >= BANDS.length) return;
      const band = BANDS[i];
      if (!(child instanceof THREE.Mesh)) return;
      const a = t * band.speed + band.phase;
      child.rotation.z = a;
      child.rotation.y = Math.sin(a * 0.35) * 0.15;
      child.position.y = Math.sin(a * 0.5) * 0.35;
      const mat = mats.current[i];
      if (mat) mat.opacity = 0.22 + Math.sin(a * 1.4) * 0.08;
    });
    curtains.current.forEach((mat, i) => {
      if (!mat) return;
      mat.opacity = 0.1 + Math.sin(t * 0.45 + i) * 0.04;
    });
  });

  return (
    <group
      ref={group}
      position={[position[0], position[1] + 0.6, position[2]]}
      rotation={[1.05, 0.15, -0.35]}
    >
      {BANDS.map((band, i) => (
        <mesh
          key={i}
          geometry={geos[i]}
          rotation={[band.tilt * 0.4, 0.35 + i * 0.2, i * 0.55]}
          scale={[1, 0.55 + i * 0.08, 1]}
          renderOrder={3}
          frustumCulled={false}
        >
          <meshBasicMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            color={band.color}
            transparent
            opacity={0.32}
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`curtain-${i}`}
          position={[
            Math.sin(i * 1.4 + 0.3) * 7.2,
            3.2 + (i % 2) * 0.6,
            Math.cos(i * 1.4 + 0.3) * 7.2,
          ]}
          rotation={[0.15, i * 0.9, Math.sin(i) * 0.2]}
          renderOrder={3}
          frustumCulled={false}
        >
          <planeGeometry args={[1.6 + i * 0.25, 9.5, 1, 1]} />
          <meshBasicMaterial
            ref={(m) => {
              curtains.current[i] = m;
            }}
            color={i % 2 === 0 ? "#7dffb8" : "#9affd0"}
            transparent
            opacity={0.14}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
