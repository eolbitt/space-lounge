"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { nearestAsteroid } from "./LoungeObjects";
import type { AvatarState, LoungeAction } from "@/lib/constants";

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
  const lookTarget = useRef(new THREE.Vector3(0.6, -2.5, -6));

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
      const desired = new THREE.Vector3(0.2, -0.2, 4.2);
      group.position.lerp(desired, 1 - Math.pow(0.02, dt));
      velocity.current.set(0, 0, 0);
      applyState("idle");
      lookTarget.current.set(0.6, -3.5, -6);
    } else if (action === "still" || action === "wave") {
      const near = nearestAsteroid(group.position);
      if (near && near.dist < 6) {
        const perch = new THREE.Vector3(
          near.spot[0],
          near.spot[1] + 0.45 + near.spot[3] * 0.15,
          near.spot[2] + 0.15,
        );
        group.position.lerp(perch, 1 - Math.pow(0.03, dt));
        applyState(
          now < waveUntil.current || action === "wave" ? "wave" : "rest",
        );
      } else {
        velocity.current.lerp(new THREE.Vector3(), 0.08);
        group.position.addScaledVector(velocity.current, dt);
        applyState(
          now < waveUntil.current || action === "wave" ? "wave" : "idle",
        );
      }
      lookTarget.current.set(0.6, -2.8, -6);
    } else {
      const wish = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup")) wish.z -= 1;
      if (keys.has("s") || keys.has("arrowdown")) wish.z += 1;
      if (keys.has("a") || keys.has("arrowleft")) wish.x -= 1;
      if (keys.has("d") || keys.has("arrowright")) wish.x += 1;
      if (keys.has("q")) wish.y += 1;
      if (keys.has("e")) wish.y -= 1;

      if (wish.lengthSq() > 0) {
        wish.normalize().multiplyScalar(1.6);
        velocity.current.lerp(wish, 0.1);
        applyState("move");
      } else {
        const t = now * 0.0002;
        velocity.current.lerp(
          new THREE.Vector3(
            Math.sin(t) * 0.22,
            Math.sin(t * 0.7) * 0.08,
            Math.cos(t * 0.9) * 0.18,
          ),
          0.03,
        );
        applyState(now < waveUntil.current ? "wave" : "idle");
      }

      group.position.addScaledVector(velocity.current, dt * 2);
      group.position.x = THREE.MathUtils.clamp(group.position.x, -7, 7);
      group.position.y = THREE.MathUtils.clamp(group.position.y, -1.6, 2.4);
      group.position.z = THREE.MathUtils.clamp(group.position.z, -2, 6.5);
      lookTarget.current.set(0.6, -2.5, -6);
    }

    const camDesired = group.position
      .clone()
      .add(new THREE.Vector3(0, 1.1, 5.2));
    camera.position.lerp(camDesired, 1 - Math.pow(0.025, dt));
    const focus = group.position.clone().add(new THREE.Vector3(0, 0.35, 0));
    if (action === "look") {
      camera.lookAt(lookTarget.current);
    } else {
      camera.lookAt(focus.clone().lerp(lookTarget.current, 0.18));
    }
  });

  return (
    <group ref={playerRef} position={[0, 0.2, 3.5]}>
      <Astronaut self state={avatarState} scale={1.05} />
    </group>
  );
}
