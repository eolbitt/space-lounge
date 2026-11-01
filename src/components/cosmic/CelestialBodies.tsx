"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
/** Matches LoungeObjects EARTH_POS. */
const EARTH_ANCHOR = new THREE.Vector3(2, -9, -16);

/** Earth billboard diameter used as scale reference. */
export const EARTH_SIZE = 18;
/** Sun diameter ≈ 10× Earth. */
export const SUN_DIAMETER = EARTH_SIZE * 10;
/**
 * Deep-space side opposite Earth (ref: empty forward vista in sun-direction-ref).
 * Placed so looking away from Earth fills the view with the sun.
 */
export const SUN_POS = EARTH_ANCHOR.clone()
  .multiplyScalar(-1)
  .normalize()
  .multiplyScalar(58)
  .add(new THREE.Vector3(-4, 14, 6));

export const BLACKHOLE_POS = new THREE.Vector3(-32, -8, -42);

/** Photoreal sphere + additive corona — no checkerboard billboard. */
export function SunBody() {
  const group = useRef<THREE.Group>(null);
  const map = useTexture("/assets/objects/sun.png");
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;

  const radius = SUN_DIAMETER * 0.5;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.rotation.y = t * 0.02;
    const pulse = 1 + Math.sin(t * 0.55) * 0.015;
    group.current.scale.setScalar(pulse);
  });

  return (
    <group ref={group} position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}>
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius, 64, 48]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
      {/* Soft photosphere rim */}
      <mesh scale={1.04} renderOrder={1}>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshBasicMaterial
          color="#ffb347"
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Corona glow shells (additive) */}
      {[1.18, 1.45, 1.85].map((s, i) => (
        <mesh key={s} scale={s} renderOrder={0}>
          <sphereGeometry args={[radius, 24, 16]} />
          <meshBasicMaterial
            color={i === 0 ? "#ffcc66" : i === 1 ? "#ff9933" : "#ff6622"}
            transparent
            opacity={0.14 - i * 0.035}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.BackSide}
          />
        </mesh>
      ))}
      <pointLight
        intensity={2.2}
        distance={SUN_DIAMETER * 3}
        decay={2}
        color="#ffd089"
      />
      <pointLight
        intensity={0.55}
        distance={SUN_DIAMETER * 5}
        decay={2}
        color="#ffe6b0"
      />
    </group>
  );
}

/** Atmospheric black hole — dark core + accretion disk, no landing. */
export function BlackHoleBody() {
  const group = useRef<THREE.Group>(null);
  const disk = useRef<THREE.Mesh>(null);
  const map = useTexture("/assets/objects/blackhole.png");
  map.colorSpace = THREE.SRGBColorSpace;

  const core = useMemo(() => {
    const g = new THREE.SphereGeometry(2.4, 32, 24);
    return g;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (disk.current) disk.current.rotation.z = t * 0.15;
    if (group.current) {
      group.current.position.y = BLACKHOLE_POS.y + Math.sin(t * 0.1) * 0.25;
    }
  });

  return (
    <group
      ref={group}
      position={[BLACKHOLE_POS.x, BLACKHOLE_POS.y, BLACKHOLE_POS.z]}
    >
      <mesh geometry={core} renderOrder={2}>
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* Soft photon-ring glow */}
      <mesh scale={1.15} renderOrder={1}>
        <sphereGeometry args={[2.4, 24, 16]} />
        <meshBasicMaterial
          color="#1a0a08"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={disk}
        rotation={[Math.PI / 2.6, 0.2, 0]}
        renderOrder={1}
      >
        <torusGeometry args={[4.2, 0.85, 16, 64]} />
        <meshBasicMaterial
          color="#ff8a3a"
          transparent
          opacity={0.72}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2.6, 0.2, 0]} scale={[1.35, 1.35, 0.35]} renderOrder={0}>
        <torusGeometry args={[4.2, 1.4, 12, 48]} />
        <meshBasicMaterial
          color="#ff5522"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* Distant sprite for silhouette richness */}
      <Billboard follow>
        <mesh renderOrder={0} scale={[14, 14, 1]} position={[0, 0, -0.5]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={map}
            transparent
            opacity={0.55}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
      <pointLight
        intensity={0.35}
        distance={22}
        color="#ff6a33"
        position={[0, 0.5, 2]}
      />
    </group>
  );
}
