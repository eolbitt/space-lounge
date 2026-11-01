"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { LOOK_AT_EARTH, nearestRestSpot } from "./LoungeObjects";
import {
  DRIFT_SPEED,
  IDLE_DRIFT,
  WORLD_BOUNDS,
  type AvatarState,
  type LoungeAction,
} from "@/lib/constants";
import { loungeAudio } from "@/lib/audio";
import { getPresenceRoom } from "@/lib/realtime";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
  action: LoungeAction;
  entered: boolean;
  onNearPod?: (near: boolean) => void;
};

const keys = new Set<string>();

/** Pointer-drag look + WASD/QE drift in true 3D (camera-relative). */
export function PlayerController({
  playerRef,
  action,
  entered,
  onNearPod,
}: Props) {
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const avatarStateRef = useRef<AvatarState>("idle");
  const waveUntil = useRef(0);

  const yaw = useRef(0);
  const pitch = useRef(-0.12);
  const dragging = useRef(false);
  const lastPtr = useRef({ x: 0, y: 0 });
  const lookEase = useRef(new THREE.Vector3());
  const publishAcc = useRef(0);
  const roomRef = useRef(getPresenceRoom());
  const nearPodRef = useRef(false);

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
    if (!entered) return;
    const room = getPresenceRoom();
    roomRef.current = room;
    const group = playerRef.current;
    if (room && group) {
      room.announce(
        [group.position.x, group.position.y, group.position.z],
        "idle",
      );
    }
    const onUnload = () => room?.leave();
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      room?.leave();
    };
  }, [entered, playerRef]);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    el.style.cursor = entered ? "grab" : "default";

    const onDown = (e: PointerEvent) => {
      if (!entered) return;
      dragging.current = true;
      lastPtr.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPtr.current.x;
      const dy = e.clientY - lastPtr.current.y;
      lastPtr.current = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * 0.0045;
      pitch.current -= dy * 0.0035;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.15, 1.15);
    };
    const onUp = (e: PointerEvent) => {
      dragging.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.style.cursor = entered ? "grab" : "default";
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [gl, entered]);

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

    // Forward/right from yaw (horizontal) for WASD
    const forward = new THREE.Vector3(
      -Math.sin(yaw.current),
      0,
      -Math.cos(yaw.current),
    );
    const right = new THREE.Vector3(
      Math.cos(yaw.current),
      0,
      -Math.sin(yaw.current),
    );

    if (action === "look") {
      const desired = new THREE.Vector3(0.5, 1.2, 4);
      group.position.lerp(desired, 1 - Math.pow(0.015, dt));
      velocity.current.set(0, 0, 0);
      applyState("idle");
      // Ease look toward Earth
      const toEarth = LOOK_AT_EARTH.clone().sub(group.position).normalize();
      const targetYaw = Math.atan2(-toEarth.x, -toEarth.z);
      const targetPitch = Math.asin(
        THREE.MathUtils.clamp(toEarth.y, -0.95, 0.95),
      );
      yaw.current = THREE.MathUtils.lerp(yaw.current, targetYaw, 0.04);
      pitch.current = THREE.MathUtils.lerp(pitch.current, targetPitch, 0.04);
    } else if (action === "still" || action === "wave") {
      const near = nearestRestSpot(group.position);
      const reach = near?.kind === "pod" ? 14 : 12;
      if (near && near.dist < reach) {
        const perch = new THREE.Vector3(
          near.spot[0],
          near.spot[1] + 0.5 + near.spot[3] * 0.12,
          near.spot[2] + 0.25,
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
    } else {
      const wish = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup")) wish.add(forward);
      if (keys.has("s") || keys.has("arrowdown")) wish.sub(forward);
      if (keys.has("a") || keys.has("arrowleft")) wish.sub(right);
      if (keys.has("d") || keys.has("arrowright")) wish.add(right);
      if (keys.has("q")) wish.y += 1;
      if (keys.has("e")) wish.y -= 1;

      // Pointer drag while holding also nudges forward slowly (optional feel)
      if (dragging.current && wish.lengthSq() === 0) {
        // no auto thrust — look only
      }

      if (wish.lengthSq() > 0) {
        wish.normalize().multiplyScalar(DRIFT_SPEED);
        velocity.current.lerp(wish, 0.14);
        applyState("move");
      } else {
        const t = now * 0.00015;
        velocity.current.lerp(
          new THREE.Vector3(
            Math.sin(t) * IDLE_DRIFT * 0.35,
            Math.sin(t * 0.7) * IDLE_DRIFT * 0.15,
            Math.cos(t * 0.9) * IDLE_DRIFT * 0.35,
          ),
          0.02,
        );
        applyState(now < waveUntil.current ? "wave" : "idle");
      }

      group.position.addScaledVector(velocity.current, dt);
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
    }

    // Soft auto-rest near lounge pod even while drifting slowly
    const rest = nearestRestSpot(group.position);
    // Hysteresis so the enter button does not flicker
    const enterDist = 5.2;
    const leaveDist = 7.2;
    let nearPod = nearPodRef.current;
    if (rest?.kind === "pod") {
      if (!nearPod && rest.dist < enterDist) nearPod = true;
      if (nearPod && rest.dist > leaveDist) nearPod = false;
    } else {
      nearPod = false;
    }
    if (nearPod !== nearPodRef.current) {
      nearPodRef.current = nearPod;
      onNearPod?.(nearPod);
    }
    if (action === "drift") {
      if (
        rest?.kind === "pod" &&
        rest.dist < 2.4 &&
        velocity.current.length() < 0.35
      ) {
        applyState("rest");
      }
    }

    publishAcc.current += dt;
    if (publishAcc.current > 0.1) {
      publishAcc.current = 0;
      roomRef.current?.publish(
        [group.position.x, group.position.y, group.position.z],
        avatarStateRef.current,
      );
    }

    // Third-person camera on a sphere behind the avatar, following look angles
    const dist = 6.8;
    const cp = pitch.current;
    const cy = yaw.current;
    const offset = new THREE.Vector3(
      Math.sin(cy) * Math.cos(cp) * dist,
      Math.sin(cp) * dist * 0.85 + 1.2,
      Math.cos(cy) * Math.cos(cp) * dist,
    );
    const camDesired = group.position.clone().add(offset);
    camera.position.lerp(camDesired, 1 - Math.pow(0.04, dt));

    lookEase.current
      .copy(group.position)
      .add(new THREE.Vector3(0, 0.45, 0))
      .add(forward.clone().multiplyScalar(2.5));
    // Blend look-at with pitch influence
    const lookAt = group.position
      .clone()
      .add(new THREE.Vector3(0, 0.5, 0))
      .add(
        new THREE.Vector3(
          -Math.sin(cy) * Math.cos(cp),
          Math.sin(cp),
          -Math.cos(cy) * Math.cos(cp),
        ).multiplyScalar(8),
      );
    camera.lookAt(lookAt);
  });

  return (
    <group ref={playerRef} position={[0, 0.6, 6]}>
      <Astronaut self state={avatarState} scale={1.05} />
    </group>
  );
}
