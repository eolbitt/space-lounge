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
  /** -1 = dive, +1 = climb (Q/E). Independent from facing. */
  tilt?: number;
  /** Floor walk — step bob instead of float/drift */
  grounded?: boolean;
};

/** Billboard sprite — facing mirrors left/right; tilt pitches up/down. */
export function Astronaut({
  state = "idle",
  self = false,
  scale = 1,
  facing = 1,
  tilt = 0,
  grounded = false,
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
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [state, textures]);

  const bobRef = useRef<THREE.Group>(null);
  const tiltGroup = useRef<THREE.Group>(null);
  const tiltSmoothed = useRef(0);
  const h = AVATAR_SIZE * scale;
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect = (img?.width || 1) / (img?.height || 1);
  const w = h * aspect;
  const face = facing < 0 ? -1 : 1;
  const verticalMode = Math.abs(tilt) > 0.2;

  useFrame(({ clock }, delta) => {
    if (!bobRef.current) return;
    let bob = 0;
    if (state === "rest") {
      bob = 0;
    } else if (grounded) {
      // Planted walk: short step bounce, no idle float
      bob =
        state === "move"
          ? Math.abs(Math.sin(clock.elapsedTime * 7.2)) * 0.028
          : 0;
    } else {
      bob =
        Math.sin(clock.elapsedTime * (state === "move" ? 2.2 : 1.1)) *
        (state === "move" ? 0.045 : 0.028);
    }
    bobRef.current.position.y = bob;

    const target = THREE.MathUtils.clamp(tilt, -1, 1);
    tiltSmoothed.current = THREE.MathUtils.damp(
      tiltSmoothed.current,
      target,
      10,
      delta,
    );
    if (tiltGroup.current) {
      const t = tiltSmoothed.current;
      // Screen-space pitch: tip top of sprite toward/away (clear up/down read)
      tiltGroup.current.rotation.x = -t * 0.85;
      tiltGroup.current.rotation.z = 0;
      // Slight vertical squash when diving / stretch when climbing
      const sy = 1 + t * 0.18;
      const sx = face * (1 - Math.abs(t) * 0.08);
      tiltGroup.current.scale.set(sx, sy, 1);
      tiltGroup.current.position.y = t * 0.06;
    }
  });

  return (
    <group ref={bobRef} userData={{ cosmicFocus: true }}>
      <Billboard follow>
        <group ref={tiltGroup}>
          <mesh position={[0, h * 0.5, 0]} renderOrder={10}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial
              map={map}
              transparent
              opacity={self ? 1 : 0.92}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          {/* Tiny motion cue chevron when climbing/diving */}
          {self && verticalMode && (
            <mesh
              position={[0, h * (tilt > 0 ? 1.05 : -0.05), 0.02]}
              renderOrder={11}
            >
              <planeGeometry args={[0.08, 0.06]} />
              <meshBasicMaterial
                color={tilt > 0 ? "#b8e0ff" : "#ffc8a0"}
                transparent
                opacity={0.55}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          )}
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
