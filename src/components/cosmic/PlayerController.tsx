"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { LOOK_AT_EARTH, nearestAsteroid } from "./LoungeObjects";
import {
  DRIFT_SPEED,
  IDLE_DRIFT,
  WORLD_BOUNDS,
  type AvatarState,
  type LoungeAction,
} from "@/lib/constants";
import { loungeAudio } from "@/lib/audio";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
  action: LoungeAction;
  entered: boolean;
};

const keys = new Set<string>();

export function PlayerController({ playerRef, action, entered }: Props) {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const avatarStateRef = useRef<AvatarState>("idle");
  const waveUntil = useRef(0);
  const lookTarget = useRef(LOOK_AT_EARTH.clone());
  const camOffset = useRef(new THREE.Vector3(0, 1.6, 7.5));

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (action === "wave") {
      waveUntil.current = performance.now() + 2200;
      avatarStateRef.current = "wave";
      setAvatarState("wave");
      loungeAudio.playSfx("wave");
    }
  }, [action]);

  function applyState(next: AvatarState) {
    if (avatarStateRef.current === next) return;
    avatarStateRef.current = next;
    setAvatarState(next);
  }

  useFrame((_, delta) => {
    const group = playerRef.current;
    if (!group || !entered) return;
    const dt = Math.min(delta, 0.05);
    const now = performance.now();

    if (action === "look") {
      // Drift toward a good Earth overlook — still free to leave via other actions
      const desired = new THREE.Vector3(0.5, 0.8, 8);
      group.position.lerp(desired, 1 - Math.pow(0.015, dt));
      velocity.current.set(0, 0, 0);
      applyState("idle");
      lookTarget.current.copy(LOOK_AT_EARTH);
      camOffset.current.set(0, 1.2, 6.2);
    } else if (action === "still" || action === "wave") {
      const near = nearestAsteroid(group.position);
      if (near && near.dist < 10) {
        const perch = new THREE.Vector3(
          near.spot[0],
          near.spot[1] + 0.5 + near.spot[3] * 0.18,
          near.spot[2] + 0.2,
        );
        group.position.lerp(perch, 1 - Math.pow(0.025, dt));
        applyState(
          now < waveUntil.current || action === "wave" ? "wave" : "rest",
        );
      } else {
        velocity.current.lerp(new THREE.Vector3(), 0.06);
        group.position.addScaledVector(velocity.current, dt);
        applyState(
          now < waveUntil.current || action === "wave" ? "wave" : "idle",
        );
      }
      lookTarget.current.copy(LOOK_AT_EARTH);
      camOffset.current.set(0, 1.5, 7.2);
    } else {
      const wish = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup")) wish.z -= 1;
      if (keys.has("s") || keys.has("arrowdown")) wish.z += 1;
      if (keys.has("a") || keys.has("arrowleft")) wish.x -= 1;
      if (keys.has("d") || keys.has("arrowright")) wish.x += 1;
      if (keys.has("q")) wish.y += 1;
      if (keys.has("e")) wish.y -= 1;

      if (wish.lengthSq() > 0) {
        wish.normalize().multiplyScalar(DRIFT_SPEED);
        velocity.current.lerp(wish, 0.12);
        applyState("move");
      } else {
        const t = now * 0.00015;
        velocity.current.lerp(
          new THREE.Vector3(
            Math.sin(t) * IDLE_DRIFT * 0.45,
            Math.sin(t * 0.7) * IDLE_DRIFT * 0.18,
            Math.cos(t * 0.9) * IDLE_DRIFT * 0.4,
          ),
          0.025,
        );
        applyState(now < waveUntil.current ? "wave" : "idle");
      }

      group.position.addScaledVector(velocity.current, dt);
      // Soft elastic bounds — nudge back instead of hard wall
      const b = WORLD_BOUNDS;
      if (Math.abs(group.position.x) > b.x) {
        group.position.x = THREE.MathUtils.clamp(group.position.x, -b.x, b.x);
        velocity.current.x *= -0.25;
      }
      if (group.position.y < b.yMin || group.position.y > b.yMax) {
        group.position.y = THREE.MathUtils.clamp(
          group.position.y,
          b.yMin,
          b.yMax,
        );
        velocity.current.y *= -0.25;
      }
      if (group.position.z < b.zMin || group.position.z > b.zMax) {
        group.position.z = THREE.MathUtils.clamp(
          group.position.z,
          b.zMin,
          b.zMax,
        );
        velocity.current.z *= -0.25;
      }
      lookTarget.current.copy(LOOK_AT_EARTH);
      camOffset.current.set(0, 1.6, 7.5);
    }

    const camDesired = group.position.clone().add(camOffset.current);
    camera.position.lerp(camDesired, 1 - Math.pow(0.03, dt));
    const focus = group.position.clone().add(new THREE.Vector3(0, 0.4, 0));
    if (action === "look") {
      camera.lookAt(lookTarget.current);
    } else {
      // Subtle pan toward Earth while following the avatar
      camera.lookAt(focus.clone().lerp(lookTarget.current, 0.12));
    }
  });

  return (
    <group ref={playerRef} position={[0, 0.4, 5]}>
      <Astronaut self state={avatarState} scale={1.05} />
    </group>
  );
}
