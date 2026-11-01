"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { ASTRONAUT_SRC, AVATAR_SIZE, type AvatarState } from "@/lib/constants";

type AstronautProps = {
  state?: AvatarState;
  self?: boolean;
  scale?: number;
};

/** Billboard sprite astronaut — never baked into the background plate. */
export function Astronaut({
  state = "idle",
  self = false,
  scale = 1,
}: AstronautProps) {
  const textures = useTexture([
    ASTRONAUT_SRC.idle,
    ASTRONAUT_SRC.move,
    ASTRONAUT_SRC.rest,
    ASTRONAUT_SRC.wave,
  ]) as THREE.Texture[];

  const map = useMemo(() => {
    const order: AvatarState[] = ["idle", "move", "rest", "wave"];
    const idx = order.indexOf(state);
    const tex = textures[idx] ?? textures[0];
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [state, textures]);

  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const h = AVATAR_SIZE * scale;
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect = (img?.width || 1) / (img?.height || 1);
  const w = h * aspect;

  useFrame(({ camera, clock }) => {
    if (!group.current) return;
    group.current.quaternion.copy(camera.quaternion);
    const bob =
      state === "rest"
        ? 0
        : Math.sin(clock.elapsedTime * (state === "move" ? 2.2 : 1.1)) *
          (state === "move" ? 0.04 : 0.025);
    group.current.position.y = bob;
    if (mat.current) {
      mat.current.opacity = self ? 1 : 0.92;
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, h * 0.5, 0]} renderOrder={10}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          ref={mat}
          map={map}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {self && (
        <pointLight
          position={[0, h * 0.4, 0.4]}
          intensity={0.35}
          distance={3}
          color="#ffe6a8"
        />
      )}
    </group>
  );
}
