"use client";

import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/** Separate starfield + nebula layers — never a single baked plate. */
export function LoungeBackdrop() {
  const [stars, nebula] = useTexture([
    "/assets/background/space-stars.png",
    "/assets/background/nebula.png",
  ]) as THREE.Texture[];

  stars.colorSpace = THREE.SRGBColorSpace;
  nebula.colorSpace = THREE.SRGBColorSpace;

  return (
    <group>
      <mesh position={[0, 4, -55]} scale={[90, 50, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={stars} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[-14, 10, -38]} scale={[55, 30, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={nebula}
          transparent
          opacity={0.55}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[18, 6, -42]} scale={[40, 24, 1]} rotation={[0, 0, -0.2]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={nebula}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
