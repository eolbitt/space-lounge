"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AVATAR_SIZE } from "@/lib/constants";

type AstronautProps = {
  position?: [number, number, number];
  suit?: string;
  accent?: string;
  self?: boolean;
  /** Soft bob amplitude */
  bob?: number;
};

/** Tiny procedural astronaut — readable silhouette, never planet-sized. */
export function Astronaut({
  position = [0, 0, 0],
  suit = "#e8eef4",
  accent = "#6a8aa8",
  self = false,
  bob = 0.04,
}: AstronautProps) {
  const group = useRef<THREE.Group>(null);
  const s = AVATAR_SIZE;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.y = position[1] + Math.sin(t * 1.1 + position[0]) * bob;
    group.current.rotation.z = Math.sin(t * 0.55 + position[2]) * 0.08;
    if (self) {
      group.current.rotation.y = Math.sin(t * 0.25) * 0.15;
    }
  });

  return (
    <group ref={group} position={position}>
      {/* Helmet */}
      <mesh position={[0, s * 0.28, 0]} castShadow>
        <sphereGeometry args={[s * 0.22, 16, 16]} />
        <meshStandardMaterial
          color={suit}
          roughness={0.35}
          metalness={0.25}
        />
      </mesh>
      {/* Visor */}
      <mesh position={[0, s * 0.28, s * 0.14]}>
        <sphereGeometry args={[s * 0.16, 12, 12]} />
        <meshStandardMaterial
          color={self ? "#1a3048" : "#243848"}
          roughness={0.15}
          metalness={0.6}
          emissive={self ? "#3a6a88" : "#1a2838"}
          emissiveIntensity={0.35}
        />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 0, 0]} castShadow>
        <capsuleGeometry args={[s * 0.14, s * 0.22, 6, 12]} />
        <meshStandardMaterial color={suit} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* Pack */}
      <mesh position={[0, 0.02, -s * 0.16]}>
        <boxGeometry args={[s * 0.2, s * 0.22, s * 0.1]} />
        <meshStandardMaterial color={accent} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Arms */}
      <mesh position={[-s * 0.22, 0.02, 0]} rotation={[0, 0, 0.35]}>
        <capsuleGeometry args={[s * 0.05, s * 0.16, 4, 8]} />
        <meshStandardMaterial color={suit} roughness={0.45} />
      </mesh>
      <mesh position={[s * 0.22, 0.02, 0]} rotation={[0, 0, -0.35]}>
        <capsuleGeometry args={[s * 0.05, s * 0.16, 4, 8]} />
        <meshStandardMaterial color={suit} roughness={0.45} />
      </mesh>
      {/* Legs */}
      <mesh position={[-s * 0.08, -s * 0.28, 0]}>
        <capsuleGeometry args={[s * 0.055, s * 0.14, 4, 8]} />
        <meshStandardMaterial color={suit} roughness={0.45} />
      </mesh>
      <mesh position={[s * 0.08, -s * 0.28, 0]}>
        <capsuleGeometry args={[s * 0.055, s * 0.14, 4, 8]} />
        <meshStandardMaterial color={suit} roughness={0.45} />
      </mesh>
      {self && (
        <pointLight
          position={[0, s * 0.1, s * 0.3]}
          intensity={0.55}
          distance={4}
          color="#9ec8e0"
        />
      )}
    </group>
  );
}
