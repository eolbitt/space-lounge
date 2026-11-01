"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";

/** Matches LoungeObjects EARTH_POS. */
const EARTH_ANCHOR = new THREE.Vector3(2, -9, -16);

/** Earth billboard diameter used as scale reference. */
export const EARTH_SIZE = 18;
/** Sun diameter ≈ 12× Earth — readable but distant landmark. */
export const SUN_DIAMETER = EARTH_SIZE * 12;
/**
 * Deep-space side opposite Earth (farther so the disk is not in the face).
 * Distance must exceed sun radius (~108) so the lounge is not inside the sphere.
 * Keep in sync with planetFlags SUN_FLAG_POS.
 */
export const SUN_POS = EARTH_ANCHOR.clone()
  .multiplyScalar(-1)
  .normalize()
  .multiplyScalar(420);

export const BLACKHOLE_POS = new THREE.Vector3(-32, -8, -42);

/**
 * View-aligned matcap sampling — flame disk fills the silhouette evenly
 * (no lat-long wrap seam, no flat center “correction band”).
 */
function makeSunMatcapMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
    },
    vertexShader: /* glsl */ `
      varying vec3 vViewNormal;
      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec3 vViewNormal;
      void main() {
        vec3 n = normalize(vViewNormal);
        vec2 uv = n.xy * 0.5 + 0.5;
        // Micro-blur kills residual bake seams without washing the flame
        vec3 tex = (
          texture2D(map, uv).rgb +
          texture2D(map, uv + vec2(0.0018, 0.0)).rgb +
          texture2D(map, uv + vec2(0.0, 0.0018)).rgb +
          texture2D(map, uv - vec2(0.0012, 0.0012)).rgb
        ) * 0.25;
        float facing = clamp(n.z, 0.0, 1.0);
        float limb = mix(0.88, 1.0, pow(facing, 0.45));
        // Opaque sphere — real depth/occlusion + perspective scale when approaching
        gl_FragColor = vec4(tex * limb, 1.0);
      }
    `,
    toneMapped: false,
    fog: false,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
}

/** Opaque sphere sun with continuous flame — no nested band shells. */
export function SunBody() {
  const group = useRef<THREE.Group>(null);
  const map = useTexture("/assets/objects/sun.png");
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;

  const radius = SUN_DIAMETER * 0.5;
  const material = useMemo(() => makeSunMatcapMaterial(map), [map]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 0.55) * 0.012;
    group.current.scale.setScalar(pulse);
  });

  return (
    <group ref={group} position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}>
      <mesh renderOrder={2} frustumCulled={false} material={material}>
        <sphereGeometry args={[radius, 96, 64]} />
      </mesh>
      <pointLight
        intensity={1.85}
        distance={SUN_DIAMETER * 3}
        decay={2}
        color="#ffd089"
      />
      <pointLight
        intensity={0.4}
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
      <mesh scale={1.15} renderOrder={1}>
        <sphereGeometry args={[2.4, 24, 16]} />
        <meshBasicMaterial
          color="#1a0a08"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={disk} rotation={[Math.PI / 2.6, 0.2, 0]} renderOrder={1}>
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
      <mesh
        rotation={[Math.PI / 2.6, 0.2, 0]}
        scale={[1.35, 1.35, 0.35]}
        renderOrder={0}
      >
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
