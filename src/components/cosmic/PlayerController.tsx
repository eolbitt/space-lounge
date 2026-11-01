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
import { touchMove, touchMoveActive } from "@/lib/touchMove";
import { nearestPlanetSite, type PlanetSite } from "@/lib/planetFlags";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
  action: LoungeAction;
  entered: boolean;
  onNearPod?: (near: boolean) => void;
  onNearPlanet?: (site: PlanetSite | null) => void;
};

const keys = new Set<string>();
const pointers = new Map<number, { x: number; y: number }>();

const CAM_DIST_MIN = 3.2;
const CAM_DIST_MAX = 16;
const CAM_DIST_DEFAULT = 6.8;

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

/**
 * Camera always frames the player dead-center.
 * Drag / pinch / wheel / double-click only change orbit yaw/pitch/zoom.
 * WASD/QE (+ mobile virtual stick) move the avatar; camera follows as orbit target.
 */
export function PlayerController({
  playerRef,
  action,
  entered,
  onNearPod,
  onNearPlanet,
}: Props) {
  const { camera, gl, scene } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const avatarStateRef = useRef<AvatarState>("idle");
  const [facing, setFacing] = useState(1);
  const facingRef = useRef(1);
  const waveUntil = useRef(0);

  const yaw = useRef(0);
  const pitch = useRef(-0.12);
  const camDist = useRef(CAM_DIST_DEFAULT);
  const camDistTarget = useRef(CAM_DIST_DEFAULT);
  const yawTarget = useRef(0);
  const pitchTarget = useRef(-0.12);

  const dragging = useRef(false);
  const lastPtr = useRef({ x: 0, y: 0 });
  const pinchStart = useRef<number | null>(null);
  const pinchDist0 = useRef(CAM_DIST_DEFAULT);
  const lastTap = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());

  const publishAcc = useRef(0);
  const roomRef = useRef(getPresenceRoom());
  const nearPodRef = useRef(false);
  const nearPlanetIdRef = useRef<string | null>(null);

  const forward = useRef(new THREE.Vector3());
  /** Camera look on XZ only — W/S never pitch into world-up. */
  const flatForward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));
  const wish = useRef(new THREE.Vector3());
  const camOffset = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const focusDir = useRef(new THREE.Vector3());

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

    const syncPinch = () => {
      if (pointers.size < 2) {
        pinchStart.current = null;
        return;
      }
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStart.current == null) {
        pinchStart.current = dist;
        pinchDist0.current = camDistTarget.current;
        dragging.current = false;
        return;
      }
      const ratio = pinchStart.current / Math.max(dist, 1);
      camDistTarget.current = THREE.MathUtils.clamp(
        pinchDist0.current * ratio,
        CAM_DIST_MIN,
        CAM_DIST_MAX,
      );
    };

    const focusToward = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      ndc.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      );
      raycaster.current.setFromCamera(ndc.current, camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      let point: THREE.Vector3 | null = null;
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o.userData?.cosmicFocus) {
            point = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
            break;
          }
          o = o.parent;
        }
        if (point) break;
        if (!point && h.distance < 80) point = h.point.clone();
      }
      if (!point) {
        // Empty space: project along ray
        point = raycaster.current.ray.origin
          .clone()
          .addScaledVector(raycaster.current.ray.direction, 18);
      }
      const player = playerRef.current;
      if (!player) return;
      focusDir.current.copy(point).sub(player.position);
      if (focusDir.current.lengthSq() < 1e-4) return;
      focusDir.current.normalize();
      // Orbit so that forward faces the focus direction — avatar stays lookAt target
      yawTarget.current = Math.atan2(-focusDir.current.x, -focusDir.current.z);
      pitchTarget.current = THREE.MathUtils.clamp(
        Math.asin(THREE.MathUtils.clamp(focusDir.current.y, -0.95, 0.95)),
        -1.15,
        1.15,
      );
      camDistTarget.current = THREE.MathUtils.clamp(
        camDistTarget.current * 0.72,
        CAM_DIST_MIN,
        CAM_DIST_MAX * 0.85,
      );
    };

    const onDown = (e: PointerEvent) => {
      if (!entered) return;
      // Stop mobile browser scroll/zoom from stealing the gesture
      if (e.cancelable) e.preventDefault();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        syncPinch();
        return;
      }
      const now = performance.now();
      // Mouse detail===2; touch uses time-based double-tap (ignore while dragging)
      const isDouble =
        e.pointerType === "mouse"
          ? e.detail === 2
          : now - lastTap.current < 280 && !dragging.current;
      lastTap.current = now;
      if (isDouble) {
        focusToward(e.clientX, e.clientY);
        dragging.current = false;
        return;
      }
      dragging.current = true;
      lastPtr.current = { x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.style.cursor = "grabbing";
    };

    const onMove = (e: PointerEvent) => {
      if (!entered) return;
      if (pointers.has(e.pointerId)) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (pointers.size >= 2) {
        if (e.cancelable) e.preventDefault();
        syncPinch();
        return;
      }
      if (!dragging.current) return;
      if (e.cancelable) e.preventDefault();
      const dx = e.clientX - lastPtr.current.x;
      const dy = e.clientY - lastPtr.current.y;
      lastPtr.current = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * 0.005;
      pitch.current -= dy * 0.0038;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.2, 1.2);
      yawTarget.current = yaw.current;
      pitchTarget.current = pitch.current;
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart.current = null;
      if (pointers.size === 0) dragging.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.style.cursor = entered ? "grab" : "default";
    };

    const onWheel = (e: WheelEvent) => {
      if (!entered) return;
      e.preventDefault();
      const next = camDistTarget.current + e.deltaY * 0.012;
      camDistTarget.current = THREE.MathUtils.clamp(
        next,
        CAM_DIST_MIN,
        CAM_DIST_MAX,
      );
    };

    // non-passive so preventDefault works on touch-capable browsers
    el.addEventListener("pointerdown", onDown, { passive: false });
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("lostpointercapture", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("lostpointercapture", onUp);
      el.removeEventListener("wheel", onWheel);
      pointers.clear();
      dragging.current = false;
    };
  }, [gl, entered, camera, scene, playerRef]);

  useEffect(() => {
    if (action === "wave") {
      waveUntil.current = performance.now() + 2200;
      avatarStateRef.current = "wave";
      setAvatarState("wave");
      // Keep residual drift — damp in the frame loop instead of hard stop
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

  useFrame((_, delta) => {
    const group = playerRef.current;
    if (!group || !entered) return;
    const dt = Math.min(delta, 0.05);
    const now = performance.now();

    // Smooth orbit toward focus targets (double-click / tap)
    yaw.current = THREE.MathUtils.damp(yaw.current, yawTarget.current, 6, dt);
    pitch.current = THREE.MathUtils.damp(
      pitch.current,
      pitchTarget.current,
      6,
      dt,
    );
    camDist.current = THREE.MathUtils.damp(
      camDist.current,
      camDistTarget.current,
      7,
      dt,
    );

    const cy = yaw.current;
    const cp = pitch.current;
    // Full look (kept for camera); W/S use flat XZ only so pitch ≠ climb/dive
    forward.current.set(
      -Math.sin(cy) * Math.cos(cp),
      Math.sin(cp),
      -Math.cos(cy) * Math.cos(cp),
    );
    flatForward.current.set(-Math.sin(cy), 0, -Math.cos(cy)).normalize();
    right.current.set(Math.cos(cy), 0, -Math.sin(cy)).normalize();
    up.current.set(0, 1, 0);

    // Touch stick wins over Rest — lets mobile exit "가만히 있기" without a race on setState
    const touchDriving = touchMoveActive();

    if (action === "wave" && !touchDriving) {
      // Soft settle into wave pose — no hard brake
      velocity.current.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.pow(0.08, dt));
      applyState(now < waveUntil.current ? "wave" : "idle");
    } else if (action === "still" && !touchDriving) {
      velocity.current.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.pow(0.12, dt));
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
        applyState(velocity.current.length() > 0.4 ? "move" : "idle");
      }
    } else {
      wish.current.set(0, 0, 0);
      let vertKey = 0;
      let latKey = 0;
      // W/S = horizontal look only (flatForward). Vertical is Q/E / ↑↓ pads only.
      // flatForward = into the scene (away from orbit camera).
      if (keys.has("w") || keys.has("arrowup"))
        wish.current.add(flatForward.current);
      if (keys.has("s") || keys.has("arrowdown"))
        wish.current.sub(flatForward.current);
      if (keys.has("d") || keys.has("arrowright")) {
        wish.current.add(right.current);
        latKey += 1;
      }
      if (keys.has("a") || keys.has("arrowleft")) {
        wish.current.sub(right.current);
        latKey -= 1;
      }
      if (keys.has("q")) {
        wish.current.add(up.current);
        vertKey += 1;
      }
      if (keys.has("e")) {
        wish.current.sub(up.current);
        vertKey -= 1;
      }

      // Mobile virtual stick / vertical pad (WASD/QE stand-in)
      if (touchMoveActive()) {
        if (Math.abs(touchMove.y) > 0.08) {
          // Stick up (+) → same as W → +flatForward
          wish.current.addScaledVector(flatForward.current, touchMove.y);
        }
        if (Math.abs(touchMove.x) > 0.08) {
          wish.current.addScaledVector(right.current, touchMove.x);
          latKey += touchMove.x > 0 ? 1 : -1;
        }
        if (touchMove.up) {
          wish.current.add(up.current);
          vertKey += 1;
        }
        if (touchMove.down) {
          wish.current.sub(up.current);
          vertKey -= 1;
        }
      }

      if (wish.current.lengthSq() > 1e-6) {
        wish.current.normalize().multiplyScalar(DRIFT_SPEED);
        // Soft accel — no snap to full speed
        velocity.current.lerp(wish.current, 1 - Math.pow(0.012, dt));
      } else {
        // Coast then settle into idle micro-float (no hard brake)
        const t = now * 0.00011;
        const idle = new THREE.Vector3(
          Math.sin(t) * IDLE_DRIFT * 0.28,
          Math.sin(t * 0.73 + 1.1) * IDLE_DRIFT * 0.14,
          Math.cos(t * 0.91) * IDLE_DRIFT * 0.28,
        );
        velocity.current.lerp(idle, 1 - Math.pow(0.18, dt));
      }

      // Facing from lateral velocity only — no geometric tilt.
      // Vertical Q/E / ↑↓ pads use up/down state (same move art).
      const latV = velocity.current.dot(right.current);
      const fwdV = velocity.current.dot(flatForward.current); // + = W / look-flat
      const vertV = velocity.current.y;
      const verticalDominant =
        vertKey !== 0 ||
        (Math.abs(vertV) > 0.45 &&
          Math.abs(vertV) >= Math.abs(latV) * 0.85 &&
          Math.abs(vertV) >= Math.abs(fwdV) * 0.55);

      if (verticalDominant) {
        const climbing = vertKey !== 0 ? vertKey > 0 : vertV > 0;
        applyState(climbing ? "up" : "down");
        if (Math.abs(latV) > 0.2) applyFacing(latV);
        else if (Math.abs(latKey) > 0) applyFacing(latKey);
      } else if (velocity.current.length() > 0.55 || wish.current.lengthSq() > 1e-6) {
        applyState("move");
        if (Math.abs(latV) > 0.2) applyFacing(latV);
        else if (Math.abs(fwdV) > 0.35 && Math.abs(latKey) > 0) {
          applyFacing(latKey);
        }
      } else {
        applyState(now < waveUntil.current ? "wave" : "idle");
      }

      group.position.addScaledVector(velocity.current, dt);
      const b = WORLD_BOUNDS;
      softBound(group.position, velocity.current, "x", -b.x, b.x);
      softBound(group.position, velocity.current, "y", b.yMin, b.yMax);
      softBound(group.position, velocity.current, "z", b.zMin, b.zMax);
    }

    const rest = nearestRestSpot(group.position);
    const enterDist = 6.2;
    const leaveDist = 9.5;
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

    const nearSite = nearestPlanetSite(group.position);
    const nearPlanetId = nearSite?.site.id ?? null;
    if (nearPlanetId !== nearPlanetIdRef.current) {
      nearPlanetIdRef.current = nearPlanetId;
      onNearPlanet?.(nearSite?.site ?? null);
    }

    if (
      action === "drift" &&
      rest?.kind === "pod" &&
      rest.dist < 2.4 &&
      velocity.current.length() < 0.35
    ) {
      applyState("rest");
    }

    // PresenceRoom applies 8–10Hz (+backoff) throttle; call a bit faster as input
    publishAcc.current += dt;
    if (publishAcc.current > 0.08) {
      publishAcc.current = 0;
      roomRef.current?.publish(
        [group.position.x, group.position.y, group.position.z],
        avatarStateRef.current,
      );
      // Lightweight debug probes for visual/mobile tests
      if (typeof window !== "undefined") {
        const w = window as unknown as {
          __cosmicPos?: [number, number, number];
          __cosmicLook?: (yaw: number, pitch: number, dist?: number) => void;
        };
        w.__cosmicPos = [
          group.position.x,
          group.position.y,
          group.position.z,
        ];
        w.__cosmicLook = (y, p, d) => {
          yaw.current = y;
          yawTarget.current = y;
          pitch.current = p;
          pitchTarget.current = p;
          if (d != null) {
            camDist.current = d;
            camDistTarget.current = d;
          }
        };
      }
    }

    // Orbit camera — lookAt is ALWAYS the player (screen-center lock)
    const dist = camDist.current;
    camOffset.current.set(
      Math.sin(cy) * Math.cos(cp) * dist,
      Math.sin(cp) * dist * 0.72 + 1.15,
      Math.cos(cy) * Math.cos(cp) * dist,
    );
    const targetCam = group.position.clone().add(camOffset.current);
    camera.position.lerp(targetCam, 1 - Math.pow(0.02, dt));
    // Hard lock look-at to avatar so they never drift off-center
    lookAt.current.copy(group.position).add(new THREE.Vector3(0, 0.42, 0));
    camera.lookAt(lookAt.current);
  });

  return (
    <group
      ref={playerRef}
      position={[0, 0.6, 6]}
      userData={{ cosmicFocus: true, kind: "self" }}
    >
      <Astronaut
        self
        state={avatarState}
        scale={1.05}
        facing={facing}
      />
    </group>
  );
}
