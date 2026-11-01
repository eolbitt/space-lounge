"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CELESTIAL_BODIES, type CelestialBody } from "@/lib/celestial";

type Props = {
  onSelect?: (body: CelestialBody) => void;
  highlightedId?: string | null;
};

function Body({
  body,
  onSelect,
  highlighted,
}: {
  body: CelestialBody;
  onSelect?: (body: CelestialBody) => void;
  highlighted: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const atmo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.rotation.y = clock.elapsedTime * (body.id === "sun" ? 0.05 : 0.12);
    }
    if (atmo.current) {
      atmo.current.rotation.y = -clock.elapsedTime * 0.04;
    }
  });

  return (
    <group position={body.position}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(body);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[body.radius, 48, 48]} />
        <meshStandardMaterial
          color={body.color}
          emissive={body.emissive ?? body.color}
          emissiveIntensity={
            highlighted
              ? (body.emissiveIntensity ?? 0.12) + 0.35
              : (body.emissiveIntensity ?? 0.08)
          }
          roughness={body.id === "sun" ? 0.35 : 0.7}
          metalness={0.05}
        />
      </mesh>

      {body.atmosphere && (
        <mesh ref={atmo} scale={1.08}>
          <sphereGeometry args={[body.radius, 32, 32]} />
          <meshStandardMaterial
            color={body.atmosphere}
            transparent
            opacity={highlighted ? 0.28 : 0.14}
            roughness={1}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {body.ring && (
        <mesh rotation={[Math.PI / 2.6, 0.2, 0.15]}>
          <ringGeometry
            args={[
              body.radius * body.ring.inner,
              body.radius * body.ring.outer,
              64,
            ]}
          />
          <meshStandardMaterial
            color={body.ring.color}
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            roughness={0.6}
          />
        </mesh>
      )}

      {body.id === "sun" && (
        <pointLight
          intensity={2.4}
          distance={120}
          decay={1.6}
          color="#ffd089"
        />
      )}
    </group>
  );
}

export function CelestialBodies({ onSelect, highlightedId }: Props) {
  return (
    <group>
      {CELESTIAL_BODIES.map((body) => (
        <Body
          key={body.id}
          body={body}
          onSelect={onSelect}
          highlighted={highlightedId === body.id}
        />
      ))}
    </group>
  );
}
