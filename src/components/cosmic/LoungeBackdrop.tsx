"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";

/**
 * Stable deep-space backdrop: procedural star sphere (no stretch)
 * + distant nebula billboards. Survives resize and free camera motion.
 */
export function LoungeBackdrop() {
  const nebula = useTexture("/assets/background/nebula.png") as THREE.Texture;
  nebula.colorSpace = THREE.SRGBColorSpace;
  nebula.wrapS = nebula.wrapT = THREE.ClampToEdgeWrapping;

  const starGeo = useMemo(() => {
    const count = 3200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Even distribution on a sphere shell
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 90 + Math.random() * 40;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = 0.75 + Math.random() * 0.25;
      colors[i * 3] = c * 0.92;
      colors[i * 3 + 1] = c * 0.95;
      colors[i * 3 + 2] = c;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  const starsRef = useRef<THREE.Points>(null);

  useFrame((_, dt) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += dt * 0.003;
    }
  });

  return (
    <group>
      {/* Soft void dome — prevents clear-color seams when looking around */}
      <mesh>
        <sphereGeometry args={[140, 32, 32]} />
        <meshBasicMaterial
          color="#05060f"
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <points ref={starsRef} geometry={starGeo} frustumCulled={false}>
        <pointsMaterial
          size={0.28}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Distant nebula plates — always face camera, fixed aspect, no tiling */}
      <Billboard follow position={[-35, 18, -55]}>
        <mesh scale={[48, 27, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={nebula}
            transparent
            opacity={0.42}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Billboard follow position={[42, 12, -48]}>
        <mesh scale={[36, 20, 1]} rotation={[0, 0, 0.15]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={nebula}
            transparent
            opacity={0.28}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Billboard follow position={[10, -8, 60]}>
        <mesh scale={[40, 22, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={nebula}
            transparent
            opacity={0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}
