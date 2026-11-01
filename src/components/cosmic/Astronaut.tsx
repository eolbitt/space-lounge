"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  ASTRONAUT_SRC,
  ASTRONAUT_UP_SRC,
  AVATAR_SIZE,
  type AvatarState,
} from "@/lib/constants";

type AstronautProps = {
  state?: AvatarState;
  self?: boolean;
  scale?: number;
  /** 1 = default sprite, -1 = mirrored (strafe left). */
  facing?: number;
  /** Floor walk — step bob instead of float/drift */
  grounded?: boolean;
};

/**
 * Billboard sprite — facing mirrors left/right.
 * Space climb/dive uses dedicated sprites (no geometric tilt).
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
    ASTRONAUT_UP_SRC.right,
    ASTRONAUT_UP_SRC.left,
    ASTRONAUT_SRC.down,
  ]) as THREE.Texture[];

  const map = useMemo(() => {
    let tex: THREE.Texture;
    if (state === "up") {
      tex = facing < 0 ? textures[5] : textures[4];
    } else if (state === "down") {
      tex = textures[6];
    } else {
      const order: AvatarState[] = ["idle", "move", "rest", "wave"];
      const idx = order.indexOf(state);
      tex = textures[idx] ?? textures[0];
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.premultiplyAlpha = false;
    tex.needsUpdate = true;
    return tex;
  }, [state, facing, textures]);

  const bobRef = useRef<THREE.Group>(null);
  const faceGroup = useRef<THREE.Group>(null);
  const facingSmoothed = useRef(facing < 0 ? -1 : 1);
  const stepPhase = useRef(0);
  const h = AVATAR_SIZE * scale;
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect = (img?.width || 1) / (img?.height || 1);
  const w = h * aspect;
  // Up/down sprites already encode direction — don't mirror those
  const mirrorFacing = state !== "up" && state !== "down";

  useFrame(({ clock }, delta) => {
    if (!bobRef.current) return;
    const faceTarget = facing < 0 ? -1 : 1;
    facingSmoothed.current = THREE.MathUtils.damp(
      facingSmoothed.current,
      faceTarget,
      grounded ? 8 : 6,
      delta,
    );
    const face = facingSmoothed.current;

    let bob = 0;
    if (state === "rest" || state === "up" || state === "down") {
      bob = 0;
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
      // Horizontal facing only — no pitch/lean tilt in space
      const lean =
        grounded && state === "move" ? -face * 0.06 : 0;
      faceGroup.current.rotation.x = 0;
      faceGroup.current.rotation.z = lean;
      faceGroup.current.scale.set(mirrorFacing ? face : 1, 1, 1);
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
              alphaTest={0.6}
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
