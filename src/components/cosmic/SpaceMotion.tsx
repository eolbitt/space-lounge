"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { EARTH_POS, SUN_POS } from "@/lib/solarSystem";

type Streak = {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  len: number;
  phase: number;
  life: number;
};

function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Comets + meteors only.
 * The Sun↔Earth rock belt was removed — it sat on the sun disk from the lounge.
 */
export function SpaceMotion() {
  const asteroidMap = useTexture(
    "/assets/objects/asteroid.png",
  ) as THREE.Texture;
  asteroidMap.colorSpace = THREE.SRGBColorSpace;

  const sunToEarth = useMemo(() => {
    const forward = EARTH_POS.clone().sub(SUN_POS).normalize();
    const side = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();
    const up = new THREE.Vector3().crossVectors(side, forward).normalize();
    return { forward, side, up };
  }, []);

  const comets = useMemo(() => {
    const { side, up } = sunToEarth;
    // Orbit centers parked on the flanks — never on the Earth→Sun axis
    const list: {
      center: THREE.Vector3;
      a: number;
      b: number;
      speed: number;
      phase: number;
      tilt: number;
      size: number;
    }[] = [];
    const flank: [number, number][] = [
      [72, 28],
      [-78, 18],
      [55, -42],
    ];
    for (let i = 0; i < flank.length; i++) {
      const [s, u] = flank[i];
      const center = SUN_POS.clone()
        .add(side.clone().multiplyScalar(s))
        .add(up.clone().multiplyScalar(u))
        .add(sunToEarth.forward.clone().multiplyScalar(40 + i * 25));
      list.push({
        center,
        a: 55 + i * 18,
        b: 32 + i * 10,
        speed: 0.045 + i * 0.012,
        phase: i * 2.1,
        tilt: 0.4 + i * 0.15,
        size: 0.5 + i * 0.12,
      });
    }
    return list;
  }, [sunToEarth]);

  const meteors = useMemo(() => {
    const list: Streak[] = [];
    for (let i = 0; i < 10; i++) {
      const origin = new THREE.Vector3(
        (seeded(i, 11) - 0.5) * 90,
        8 + seeded(i, 12) * 40,
        (seeded(i, 13) - 0.5) * 90 - 10,
      );
      const dir = new THREE.Vector3(
        (seeded(i, 14) - 0.5) * 0.6,
        -0.55 - seeded(i, 15) * 0.35,
        (seeded(i, 16) - 0.35) * 0.8,
      ).normalize();
      list.push({
        origin,
        dir,
        speed: 18 + seeded(i, 17) * 28,
        len: 2.2 + seeded(i, 18) * 3.5,
        phase: seeded(i, 19) * 12,
        life: 1.4 + seeded(i, 20) * 1.8,
      });
    }
    return list;
  }, []);

  const cometGroup = useRef<THREE.Group>(null);
  const meteorGroup = useRef<THREE.Group>(null);
  const cometTailMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const meteorMats = useRef<THREE.MeshBasicMaterial[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cometGroup.current) {
      cometGroup.current.children.forEach((child, i) => {
        const c = comets[i];
        if (!c) return;
        const u = t * c.speed + c.phase;
        const x = Math.cos(u) * c.a;
        const z = Math.sin(u) * c.b;
        const y = Math.sin(u * 0.5) * 12;
        child.position.set(
          c.center.x + x,
          c.center.y + y * Math.cos(c.tilt) + z * Math.sin(c.tilt) * 0.2,
          c.center.z + z * Math.cos(c.tilt),
        );
        const mat = cometTailMats.current[i];
        if (mat) mat.opacity = 0.35 + Math.sin(u) * 0.12;
      });
    }
    if (meteorGroup.current) {
      meteorGroup.current.children.forEach((child, i) => {
        const m = meteors[i];
        if (!m) return;
        const cycle = 6 + i * 0.7;
        const local = ((t + m.phase) % cycle) / cycle;
        const active = local < m.life / cycle;
        child.visible = active;
        if (!active) return;
        const u = (local * cycle) / m.life;
        const traveled = u * m.speed * m.life;
        child.position.copy(m.origin).addScaledVector(m.dir, traveled);
        const look = m.origin.clone().addScaledVector(m.dir, traveled + 1);
        child.lookAt(look);
        const mat = meteorMats.current[i];
        if (mat) {
          mat.opacity = u < 0.15 ? u / 0.15 : u > 0.75 ? (1 - u) / 0.25 : 0.9;
        }
      });
    }
  });

  return (
    <group>
      <group ref={cometGroup}>
        {comets.map((c, i) => (
          <group key={`comet-${i}`} position={c.center.toArray()}>
            <Billboard follow>
              <mesh scale={[c.size, c.size, 1]} renderOrder={4}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial
                  map={asteroidMap}
                  transparent
                  alphaTest={0.45}
                  depthWrite
                  toneMapped={false}
                  color="#d8e8ff"
                />
              </mesh>
              <mesh
                position={[-c.size * 1.8, 0, -0.02]}
                scale={[c.size * 4.5, c.size * 0.55, 1]}
                renderOrder={3}
              >
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial
                  ref={(m) => {
                    if (m) cometTailMats.current[i] = m;
                  }}
                  color="#9ec8ff"
                  transparent
                  opacity={0.4}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  toneMapped={false}
                />
              </mesh>
            </Billboard>
          </group>
        ))}
      </group>

      <group ref={meteorGroup}>
        {meteors.map((m, i) => (
          <mesh
            key={`meteor-${i}`}
            position={m.origin.toArray()}
            scale={[0.08, 0.08, m.len]}
            renderOrder={5}
            visible={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              ref={(mtrl) => {
                if (mtrl) meteorMats.current[i] = mtrl;
              }}
              color="#ffe6b0"
              transparent
              opacity={0.85}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
