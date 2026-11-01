"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { ASTRONAUT_SRC, AVATAR_SIZE, type AvatarState } from "@/lib/constants";

type AstronautProps = {
  state?: AvatarState;
  self?: boolean;
  scale?: number;
  /** 1 = default sprite, -1 = mirrored (strafe left). */
  facing?: number;
  /** Floor walk — step bob instead of float/drift */
  grounded?: boolean;
};

const STATE_ORDER: AvatarState[] = [
  "idle",
  "move",
  "rest",
  "wave",
  "up",
  "down",
];

/**
 * Billboard sprite — same Space Lounge suit art for all poses.
 * Vertical travel uses dedicated up/down sprites (not left/right move).
 */
export function Astronaut({
  state = "idle",
  self = false,
  scale = 1,
  facing = 1,
  grounded = false,
}: AstronautProps) {
  const textures = useTexture([
    ASTRONAUT_SRC.idle,
    ASTRONAUT_SRC.move,
    ASTRONAUT_SRC.rest,
    ASTRONAUT_SRC.wave,
    ASTRONAUT_SRC.up,
    ASTRONAUT_SRC.down,
  ]) as THREE.Texture[];

  const map = useMemo(() => {
    const idx = Math.max(0, STATE_ORDER.indexOf(state));
    const tex = textures[idx] ?? textures[0];
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
    return tex;
  }, [state, textures]);

  const bobRef = useRef<THREE.Group>(null);
  const faceGroup = useRef<THREE.Group>(null);
  const stepPhase = useRef(0);
  const h = AVATAR_SIZE * scale;
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect = (img?.width || 1) / (img?.height || 1);
  const w = h * aspect;
  /** Hard snap — no scale.x damp. */
  const face = facing < 0 ? -1 : 1;

  useFrame(({ clock }, delta) => {
    if (!bobRef.current) return;

    let bob = 0;
    if (state === "rest") {
      bob = 0;
      stepPhase.current = 0;
    } else if (state === "up" || state === "down") {
      bob = state === "up" ? 0.014 : -0.01;
      stepPhase.current = 0;
    } else if (grounded) {
      if (state === "move") {
        stepPhase.current += delta * 9.5;
        bob = Math.abs(Math.sin(stepPhase.current)) * 0.032;
      } else {
        stepPhase.current = THREE.MathUtils.damp(
          stepPhase.current,
          0,
          6,
          delta,
        );
        bob = 0;
      }
    } else {
      const amp = state === "move" ? 0.048 : 0.022;
      const spd = state === "move" ? 2.4 : 0.95;
      bob = Math.sin(clock.elapsedTime * spd) * amp;
    }
    bobRef.current.position.y = bob;

    if (faceGroup.current) {
      faceGroup.current.rotation.x = 0;
      faceGroup.current.rotation.z = 0;
      // Instant mirror only — vertical art is already posed
      faceGroup.current.scale.set(face, 1, 1);
      faceGroup.current.position.y = 0;
    }
  });

  return (
    <group ref={bobRef} userData={{ cosmicFocus: true }}>
      <Billboard follow>
        <group ref={faceGroup}>
          <mesh position={[0, h * 0.5, 0]} renderOrder={10}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial
              map={map}
              transparent
              // Lower than before so filled opaque visor stays solid; soft edges still cut
              alphaTest={0.28}
              opacity={1}
              depthWrite
              depthTest
              side={THREE.DoubleSide}
              toneMapped={false}
              alphaToCoverage={false}
            />
          </mesh>
        </group>
      </Billboard>
      {self && (
        <pointLight
          position={[0, h * 0.4, 0.35]}
          intensity={0.4}
          distance={3.5}
          color="#ffe6a8"
        />
      )}
    </group>
  );
}
