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

/** Small drifting rock belt + comets + occasional meteor streaks. */
export function SpaceMotion() {
  const asteroidMap = useTexture("/assets/objects/asteroid.png") as THREE.Texture;
  asteroidMap.colorSpace = THREE.SRGBColorSpace;

  const belt = useMemo(() => {
    const sunToEarth = EARTH_POS.clone().sub(SUN_POS);
    const dist = sunToEarth.length();
    const forward = sunToEarth.clone().normalize();
    const side = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();
    const up = new THREE.Vector3().crossVectors(side, forward).normalize();
    // Sparse belt between Mars–Jupiter band (~0.55–0.7 along Sun→Earth + beyond)
    const items: {
      base: THREE.Vector3;
      size: number;
      spin: number;
      wobble: number;
      drift: number;
    }[] = [];
    for (let i = 0; i < 28; i++) {
      const along = 0.52 + seeded(i, 1) * 0.22;
      const radial = (seeded(i, 2) - 0.5) * 48;
      const elev = (seeded(i, 3) - 0.5) * 22;
      const base = SUN_POS.clone()
        .add(forward.clone().multiplyScalar(dist * along))
        .add(side.clone().multiplyScalar(radial))
        .add(up.clone().multiplyScalar(elev));
      items.push({
        base,
        size: 0.28 + seeded(i, 4) * 0.55,
        spin: 0.15 + seeded(i, 5) * 0.4,
        wobble: 0.4 + seeded(i, 6) * 1.2,
        drift: 0.08 + seeded(i, 7) * 0.2,
      });
    }
    return items;
  }, []);

  const comets = useMemo(() => {
    const list: {
      center: THREE.Vector3;
      a: number;
      b: number;
      speed: number;
      phase: number;
      tilt: number;
      size: number;
    }[] = [];
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.4;
      const center = SUN_POS.clone().add(
        new THREE.Vector3(
          Math.cos(ang) * 40,
          18 + i * 12,
          Math.sin(ang) * 40,
        ),
      );
      list.push({
        center,
        a: 160 + i * 55,
        b: 70 + i * 25,
        speed: 0.05 + i * 0.012,
        phase: i * 2.1,
        tilt: 0.35 + i * 0.2,
        size: 0.55 + i * 0.15,
      });
    }
    return list;
  }, []);

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

  const beltGroup = useRef<THREE.Group>(null);
  const cometGroup = useRef<THREE.Group>(null);
  const meteorGroup = useRef<THREE.Group>(null);
  const cometTailMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const meteorMats = useRef<THREE.MeshBasicMaterial[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beltGroup.current) {
      beltGroup.current.children.forEach((child, i) => {
        const item = belt[i];
        if (!item) return;
        const ang = t * item.drift + i;
        child.position.set(
          item.base.x + Math.cos(ang) * item.wobble,
          item.base.y + Math.sin(ang * 0.7) * item.wobble * 0.45,
          item.base.z + Math.sin(ang * 0.9) * item.wobble,
        );
        child.rotation.z = t * item.spin;
      });
    }
    if (cometGroup.current) {
      cometGroup.current.children.forEach((child, i) => {
        const c = comets[i];
        if (!c) return;
        const u = t * c.speed + c.phase;
        const x = Math.cos(u) * c.a;
        const z = Math.sin(u) * c.b;
        const y = Math.sin(u * 0.5) * 12;
        // Tilted ellipse around sun-ish center
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
        // Aim streak along flight
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
      <group ref={beltGroup}>
        {belt.map((item, i) => (
          <Billboard key={`belt-${i}`} follow position={item.base.toArray()}>
            <mesh scale={[item.size, item.size, 1]} renderOrder={3}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={asteroidMap}
                transparent
                alphaTest={0.5}
                depthWrite
                toneMapped={false}
              />
            </mesh>
          </Billboard>
        ))}
      </group>

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
