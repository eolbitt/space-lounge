"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { nearestRestSpot } from "./LoungeObjects";
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

function softBound(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  axis: "x" | "y" | "z",
  min: number,
  max: number,
) {
  if (pos[axis] < min) {
    pos[axis] = min;
    vel[axis] *= -0.25;
  } else if (pos[axis] > max) {
    pos[axis] = max;
    vel[axis] *= -0.25;
  }
}

/** Pointer-drag look + camera-relative WASD/QE drift in true 3D. */
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
  const [facing, setFacing] = useState(1);
  const facingRef = useRef(1);
  const [tilt, setTilt] = useState(0);
  const tiltRef = useRef(0);
  const waveUntil = useRef(0);

  const yaw = useRef(0);
  const pitch = useRef(-0.12);
  const dragging = useRef(false);
  const lastPtr = useRef({ x: 0, y: 0 });
  const publishAcc = useRef(0);
  const roomRef = useRef(getPresenceRoom());
  const nearPodRef = useRef(false);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));
  const wish = useRef(new THREE.Vector3());
  const camOffset = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "q",
          "e",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      ) {
        e.preventDefault();
      }
      keys.add(k);
    };
    const upKey = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", upKey);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", upKey);
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
      // Ignore UI clicks bubbling — only canvas
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
      // Drag right → look right
      yaw.current -= dx * 0.005;
      pitch.current -= dy * 0.0038;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.2, 1.2);
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
      velocity.current.set(0, 0, 0);
      keys.clear();
      loungeAudio.playSfx("wave");
    }
  }, [action]);

  function applyState(next: AvatarState) {
    if (avatarStateRef.current === next) return;
    avatarStateRef.current = next;
    setAvatarState(next);
  }

  function applyFacing(dir: number) {
    if (dir === 0) return;
    const next = dir > 0 ? 1 : -1;
    if (facingRef.current !== next) {
      facingRef.current = next;
      setFacing(next);
    }
  }

  function applyTilt(next: number) {
    const clamped = THREE.MathUtils.clamp(next, -1, 1);
    if (Math.abs(tiltRef.current - clamped) < 0.04) return;
    tiltRef.current = clamped;
    setTilt(clamped);
  }

  useFrame((_, delta) => {
    const group = playerRef.current;
    if (!group || !entered) return;
    const dt = Math.min(delta, 0.05);
    const now = performance.now();

    // Camera-relative axes from look yaw/pitch (matches what user sees)
    const cy = yaw.current;
    const cp = pitch.current;
    forward.current.set(
      -Math.sin(cy) * Math.cos(cp),
      Math.sin(cp),
      -Math.cos(cy) * Math.cos(cp),
    );
    // Horizontal strafe (ignore pitch so A/D stay level)
    right.current.set(Math.cos(cy), 0, -Math.sin(cy)).normalize();
    up.current.set(0, 1, 0);

    if (action === "wave") {
      // Hold world position — wave is motion-only, no drift/perch.
      velocity.current.set(0, 0, 0);
      applyTilt(0);
      applyState(now < waveUntil.current ? "wave" : "idle");
    } else if (action === "still") {
      applyTilt(0);
      velocity.current.set(0, 0, 0);
      const near = nearestRestSpot(group.position);
      const reach = near?.kind === "pod" ? 14 : 12;
      if (near && near.dist < reach) {
        const perch = new THREE.Vector3(
          near.spot[0],
          near.spot[1] + 0.5 + near.spot[3] * 0.12,
          near.spot[2] + 0.25,
        );
        group.position.lerp(perch, 1 - Math.pow(0.025, dt));
        applyState("rest");
      } else {
        applyState("idle");
      }
    } else {
      wish.current.set(0, 0, 0);
      if (keys.has("w") || keys.has("arrowup")) {
        wish.current.add(forward.current);
      }
      if (keys.has("s") || keys.has("arrowdown")) {
        wish.current.sub(forward.current);
      }
      if (keys.has("d") || keys.has("arrowright")) {
        wish.current.add(right.current);
      }
      if (keys.has("a") || keys.has("arrowleft")) {
        wish.current.sub(right.current);
      }
      if (keys.has("q")) wish.current.add(up.current);
      if (keys.has("e")) wish.current.sub(up.current);

      if (wish.current.lengthSq() > 1e-6) {
        wish.current.normalize().multiplyScalar(DRIFT_SPEED);
        velocity.current.lerp(wish.current, 0.16);
        applyState("move");
        // Mirror from camera-relative lateral intent (A/D or diagonal).
        // Pure W/S keeps last facing so the sprite doesn't flicker.
        const lateral = wish.current.dot(right.current);
        if (Math.abs(lateral) > 0.08) applyFacing(lateral);
        // Vertical intent (Q/E) → climb/dive tilt
        const vertical = wish.current.dot(up.current);
        applyTilt(vertical / DRIFT_SPEED);
      } else {
        const t = now * 0.00012;
        velocity.current.lerp(
          new THREE.Vector3(
            Math.sin(t) * IDLE_DRIFT * 0.25,
            Math.sin(t * 0.7 + 1.2) * IDLE_DRIFT * 0.12,
            Math.cos(t * 0.9) * IDLE_DRIFT * 0.25,
          ),
          0.02,
        );
        applyState(now < waveUntil.current ? "wave" : "idle");
        applyTilt(0);
      }

      group.position.addScaledVector(velocity.current, dt);
      const b = WORLD_BOUNDS;
      softBound(group.position, velocity.current, "x", -b.x, b.x);
      softBound(group.position, velocity.current, "y", b.yMin, b.yMax);
      softBound(group.position, velocity.current, "z", b.zMin, b.zMax);
    }

    const rest = nearestRestSpot(group.position);
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
    if (
      action === "drift" &&
      rest?.kind === "pod" &&
      rest.dist < 2.4 &&
      velocity.current.length() < 0.35
    ) {
      applyState("rest");
    }

    publishAcc.current += dt;
    if (publishAcc.current > 0.1) {
      publishAcc.current = 0;
      roomRef.current?.publish(
        [group.position.x, group.position.y, group.position.z],
        avatarStateRef.current,
      );
    }

    // Third-person camera behind look direction
    const dist = 6.8;
    camOffset.current.set(
      Math.sin(cy) * Math.cos(cp) * dist,
      Math.sin(cp) * dist * 0.75 + 1.35,
      Math.cos(cy) * Math.cos(cp) * dist,
    );
    camera.position.lerp(
      group.position.clone().add(camOffset.current),
      1 - Math.pow(0.045, dt),
    );
    lookAt.current
      .copy(group.position)
      .add(new THREE.Vector3(0, 0.45, 0))
      .addScaledVector(forward.current, 6);
    camera.lookAt(lookAt.current);
  });

  return (
    <group ref={playerRef} position={[0, 0.6, 6]}>
      <Astronaut
        self
        state={avatarState}
        scale={1.05}
        facing={facing}
        tilt={tilt}
      />
    </group>
  );
}
