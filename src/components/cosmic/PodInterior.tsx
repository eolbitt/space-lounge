"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { LoungeBackdrop } from "./LoungeBackdrop";
import { EARTH_POS, LoungeObjects } from "./LoungeObjects";
import { SUN_POS } from "./CelestialBodies";
import { getPresenceRoom, type PeerPose } from "@/lib/realtime";
import type { AvatarState } from "@/lib/constants";
import { touchMove, touchMoveActive } from "@/lib/touchMove";

/** Expanded pod floor bounds (XZ) — open center for walking */
const FLOOR = {
  minX: -5.6,
  maxX: 5.6,
  minZ: -4.6,
  maxZ: 4.4,
} as const;

const WALK_SPEED = 2.2;
const FLOOR_Y = 0;
const AVATAR_SCALE = 2.95;
const PEER_SCALE = 2.7;
const SIT_REACH = 1.75;

type SitVista = "earth" | "sun";
type SitSide = "left" | "right";

type Seat = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  sitY: number;
  facing: number;
  /** Fullscreen sit look — opposite (+Z) → Earth; window (−Z) → sun */
  vista: SitVista;
  /** Left/right chair bank — biases sit camera */
  side: SitSide;
};

/** Chairs at edges — walkable through (no furniture collision) */
const SEATS: Seat[] = [
  { id: "c0", x: -3.7, z: 2.85, yaw: 0.45, sitY: 0.32, facing: 1, vista: "earth", side: "left" },
  { id: "c1", x: -1.85, z: 3.35, yaw: 0.08, sitY: 0.32, facing: 1, vista: "earth", side: "left" },
  { id: "c2", x: 3.45, z: 2.7, yaw: -0.55, sitY: 0.32, facing: -1, vista: "earth", side: "right" },
  { id: "c3", x: 1.85, z: -3.35, yaw: Math.PI * 0.9, sitY: 0.32, facing: 1, vista: "sun", side: "right" },
  { id: "c4", x: -3.35, z: -3.2, yaw: Math.PI * 1.1, sitY: 0.32, facing: -1, vista: "sun", side: "left" },
];

/** Soft room edge only — furniture/chairs are pass-through */
function clampFloor(x: number, z: number): [number, number] {
  return [
    THREE.MathUtils.clamp(x, FLOOR.minX, FLOOR.maxX),
    THREE.MathUtils.clamp(z, FLOOR.minZ, FLOOR.maxZ),
  ];
}

function nearestSeat(x: number, z: number): { seat: Seat; dist: number } | null {
  let best: { seat: Seat; dist: number } | null = null;
  for (const seat of SEATS) {
    const d = Math.hypot(x - seat.x, z - seat.z);
    if (d <= SIT_REACH && (!best || d < best.dist)) best = { seat, dist: d };
  }
  return best;
}

const keys = new Set<string>();

function useWalkKeys(active: boolean) {
  useEffect(() => {
    if (!active) {
      keys.clear();
      return;
    }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "e",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      ) {
        e.preventDefault();
        keys.add(k);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.clear();
    };
  }, [active]);
}

export type SitHud = {
  nearSeat: boolean;
  sitting: boolean;
  seatLabel: string | null;
  vista: SitVista;
  side: SitSide;
};

type WalkerProps = {
  onSitHud: (hud: SitHud) => void;
  sitRequest: number;
  standRequest: number;
  seatTapId: string | null;
  sitting: boolean;
};

/**
 * Full-screen sit vista — same lounge backdrop + celestial assets.
 * Opposite seats → Earth; window seats → sun; left/right bank shifts angle.
 */
function SitSpaceView({
  vista,
  side,
}: {
  vista: SitVista;
  side: SitSide;
}) {
  const look = useRef(new THREE.Vector3());
  const sunBias = useMemo(
    () => EARTH_POS.clone().lerp(SUN_POS, 0.42),
    [],
  );
  const earthFocus = useMemo(
    () => EARTH_POS.clone().add(new THREE.Vector3(0, 2, 4)),
    [],
  );
  const sideSign = side === "left" ? -1 : 1;

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    if (vista === "earth") {
      // Left bank looks past Earth from −X; right bank from +X
      const yaw = sideSign * 0.95 + Math.sin(t * 0.035) * 0.14;
      const pitch = -0.14 + Math.sin(t * 0.04) * 0.05;
      const dist = 26 + Math.sin(t * 0.03) * 2;
      camera.position.set(
        EARTH_POS.x + Math.sin(yaw) * dist * 0.7 + sideSign * 14,
        EARTH_POS.y + 6.5 + Math.sin(t * 0.05) * 1.2,
        EARTH_POS.z + Math.cos(yaw) * dist + 10,
      );
      look.current.copy(earthFocus);
      look.current.x += sideSign * 7 + Math.sin(t * 0.04) * 1.0;
      look.current.y += Math.cos(t * 0.03) * 1.0;
    } else {
      // Sun window: left bank orbits −side, right bank +side
      const yaw = t * 0.022 + Math.PI * 0.5 + sideSign * 1.15;
      const pitch = 0.08 + Math.sin(t * 0.045) * 0.05;
      const dist = 18 + Math.sin(t * 0.033) * 2.2;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist + sideSign * 7,
        5.2 + Math.sin(t * 0.05) * 2.0,
        Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      look.current.copy(sunBias);
      look.current.x += sideSign * 14 + Math.sin(t * 0.04) * 4;
      look.current.y += Math.cos(t * 0.035) * 3.5;
    }
    camera.lookAt(look.current);
    camera.near = 0.05;
    camera.far = 2500;
    camera.updateProjectionMatrix();
  });

  return (
    <Suspense fallback={null}>
      <color attach="background" args={["#05060f"]} />
      <ambientLight intensity={0.5} color="#c8d4e8" />
      <directionalLight position={[10, 14, 8]} intensity={0.5} color="#fff0d0" />
      <hemisphereLight args={["#6a8498", "#0a1018", 0.35]} />
      <LoungeBackdrop />
      <LoungeObjects />
      <pointLight
        position={[2, -4, -8]}
        intensity={1.15}
        distance={48}
        color="#6a9ad8"
      />
      <pointLight
        position={[-8, -1, 4]}
        intensity={0.4}
        distance={22}
        color="#ffb060"
      />
    </Suspense>
  );
}

/**
 * Elevated 3/4 walk cam. Sitting swaps to full-screen space (handled by parent scene).
 */
function PodWalker({
  onSitHud,
  sitRequest,
  standRequest,
  seatTapId,
  sitting: sittingProp,
}: WalkerProps) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [state, setState] = useState<AvatarState>("idle");
  const [facing, setFacing] = useState(1);
  const pos = useRef(new THREE.Vector3(-0.2, FLOOR_Y, 0.8));
  const sitting = useRef(false);
  const seatId = useRef<string | null>(null);
  const vistaRef = useRef<SitVista>("sun");
  const sideRef = useRef<SitSide>("left");
  const publishAcc = useRef(0);
  const lastSitReq = useRef(0);
  const lastStandReq = useRef(0);
  const lastTap = useRef<string | null>(null);
  const eWasDown = useRef(false);
  const wish = useRef(new THREE.Vector3());
  const vel = useRef(new THREE.Vector3());
  const facingSmooth = useRef(1);
  const camTarget = useRef(new THREE.Vector3(0.2, 0.85, -0.4));
  const camPos = useRef(new THREE.Vector3(9.2, 5.4, 7.4));

  useWalkKeys(!sittingProp);

  const sitOn = useCallback((seat: Seat) => {
    sitting.current = true;
    seatId.current = seat.id;
    vistaRef.current = seat.vista;
    sideRef.current = seat.side;
    pos.current.set(seat.x, seat.sitY, seat.z);
    setFacing(seat.facing);
    setState("rest");
  }, []);

  const standUp = useCallback(() => {
    if (!sitting.current) return;
    const seat = SEATS.find((s) => s.id === seatId.current);
    sitting.current = false;
    seatId.current = null;
    vistaRef.current = "sun";
    sideRef.current = "left";
    if (seat) {
      // Step toward room center — no collider to snag on
      const ox = -Math.sin(seat.yaw) * 0.85;
      const oz = -Math.cos(seat.yaw) * 0.85;
      const [nx, nz] = clampFloor(seat.x + ox, seat.z + oz);
      pos.current.set(nx, FLOOR_Y, nz);
    } else {
      pos.current.y = FLOOR_Y;
    }
    setState("idle");
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const clamped = Math.min(dt, 0.05);

    if (sitRequest !== lastSitReq.current) {
      lastSitReq.current = sitRequest;
      const near = nearestSeat(pos.current.x, pos.current.z);
      if (!sitting.current && near) sitOn(near.seat);
    }
    if (standRequest !== lastStandReq.current) {
      lastStandReq.current = standRequest;
      standUp();
    }
    if (seatTapId && seatTapId !== lastTap.current) {
      lastTap.current = seatTapId;
      const seat = SEATS.find((s) => s.id === seatTapId);
      if (seat) {
        if (sitting.current && seatId.current === seat.id) standUp();
        else {
          const d = Math.hypot(pos.current.x - seat.x, pos.current.z - seat.z);
          if (d <= SIT_REACH + 0.5 || sitting.current) {
            if (sitting.current) standUp();
            sitOn(seat);
          }
        }
      }
    }

    const eDown = keys.has("e");
    if (eDown && !eWasDown.current) {
      if (sitting.current) standUp();
      else {
        const near = nearestSeat(pos.current.x, pos.current.z);
        if (near) sitOn(near.seat);
      }
    }
    eWasDown.current = eDown;

    let mx = 0;
    let mz = 0;
    if (!sitting.current) {
      if (keys.has("w") || keys.has("arrowup")) mz -= 1;
      if (keys.has("s") || keys.has("arrowdown")) mz += 1;
      if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
      if (keys.has("d") || keys.has("arrowright")) mx += 1;
      if (touchMoveActive()) {
        mz -= touchMove.y;
        mx += touchMove.x;
      }
    }

    wish.current.set(0, 0, 0);
    if (mx !== 0 || mz !== 0) {
      wish.current.set(mx, 0, mz);
      if (wish.current.lengthSq() > 1e-6) {
        wish.current.normalize().multiplyScalar(WALK_SPEED);
      }
    }

    if (sitting.current) {
      vel.current.set(0, 0, 0);
      setState("rest");
      const seat = SEATS.find((s) => s.id === seatId.current);
      if (seat) pos.current.set(seat.x, seat.sitY, seat.z);
      g.visible = false;
    } else {
      g.visible = true;
      // Accel toward wish / soft damp when released — furniture pass-through
      if (wish.current.lengthSq() > 1e-6) {
        vel.current.lerp(wish.current, 1 - Math.pow(0.01, clamped));
      } else {
        vel.current.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.pow(0.06, clamped));
        if (vel.current.length() < 0.04) vel.current.set(0, 0, 0);
      }

      const [nx, nz] = clampFloor(
        pos.current.x + vel.current.x * clamped,
        pos.current.z + vel.current.z * clamped,
      );
      pos.current.x = nx;
      pos.current.z = nz;
      pos.current.y = FLOOR_Y;

      const speed = Math.hypot(vel.current.x, vel.current.z);
      if (speed > 0.15) {
        setState("move");
        // Prefer screen-left/right (Z) for facing; lerp via Astronaut
        let faceTarget = facingSmooth.current;
        if (Math.abs(vel.current.z) >= Math.abs(vel.current.x) * 0.55) {
          faceTarget = vel.current.z > 0 ? -1 : 1;
        } else if (Math.abs(vel.current.x) > 0.12) {
          faceTarget = vel.current.x > 0 ? 1 : -1;
        }
        facingSmooth.current = THREE.MathUtils.damp(
          facingSmooth.current,
          faceTarget,
          7,
          clamped,
        );
        setFacing(facingSmooth.current >= 0 ? 1 : -1);
      } else {
        setState("idle");
      }

      camTarget.current.set(
        pos.current.x * 0.28 + 0.15,
        0.85,
        pos.current.z * 0.35 - 0.55,
      );
      const desired = new THREE.Vector3(
        9.0 + pos.current.x * 0.12,
        5.35,
        7.2 + pos.current.z * 0.22,
      );
      camPos.current.lerp(desired, 1 - Math.pow(0.004, clamped));
      camera.position.copy(camPos.current);
      camera.lookAt(camTarget.current);
    }

    g.position.copy(pos.current);

    const near = sitting.current
      ? null
      : nearestSeat(pos.current.x, pos.current.z);
    onSitHud({
      nearSeat: Boolean(near) || sitting.current,
      sitting: sitting.current,
      seatLabel: sitting.current
        ? sideRef.current === "left"
          ? "왼쪽 시야"
          : "오른쪽 시야"
        : near
          ? near.seat.side === "left"
            ? "왼쪽 의자"
            : "오른쪽 의자"
          : null,
      vista: sitting.current ? vistaRef.current : near?.seat.vista ?? "sun",
      side: sitting.current ? sideRef.current : near?.seat.side ?? "left",
    });

    publishAcc.current += clamped;
    if (publishAcc.current > 0.12) {
      publishAcc.current = 0;
      const spd = Math.hypot(vel.current.x, vel.current.z);
      getPresenceRoom()?.publishLounge(
        [pos.current.x, pos.current.z],
        sitting.current ? "rest" : spd > 0.15 ? "move" : "idle",
      );
    }
  });

  return (
    <group ref={group} position={[-0.2, FLOOR_Y, 0.8]}>
      <Astronaut
        self
        state={state}
        scale={AVATAR_SCALE}
        facing={facing}
        tilt={0}
        grounded
      />
    </group>
  );
}

function LoungePeers({ hidden }: { hidden: boolean }) {
  const [peers, setPeers] = useState<Map<string, PeerPose>>(new Map());

  useEffect(() => {
    const r = getPresenceRoom();
    if (!r) return;
    return r.subscribe({
      onPeers: (next) => setPeers(new Map(next)),
    });
  }, []);

  const bodies = useMemo(() => {
    const list: {
      id: string;
      x: number;
      z: number;
      y: number;
      state: AvatarState;
      facing: number;
    }[] = [];
    for (const peer of peers.values()) {
      if (!peer.lounge) continue;
      const seat = SEATS.find(
        (s) =>
          Math.hypot(peer.lounge![0] - s.x, peer.lounge![1] - s.z) < 0.35,
      );
      list.push({
        id: peer.id,
        x: peer.lounge[0],
        z: peer.lounge[1],
        y: peer.state === "rest" && seat ? seat.sitY : FLOOR_Y,
        state:
          peer.state === "rest"
            ? "rest"
            : peer.state === "move"
              ? "move"
              : "idle",
        facing: seat?.facing ?? 1,
      });
    }
    return list;
  }, [peers]);

  if (hidden) return null;

  return (
    <group>
      {bodies.map((b) => (
        <group key={b.id} position={[b.x, b.y, b.z]}>
          <Astronaut
            state={b.state}
            scale={PEER_SCALE}
            facing={b.facing}
            grounded
          />
        </group>
      ))}
    </group>
  );
}

function WarmChair({
  seat,
  onTap,
}: {
  seat: Seat;
  onTap: (id: string) => void;
}) {
  return (
    <group
      position={[seat.x, 0, seat.z]}
      rotation={[0, seat.yaw, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onTap(seat.id);
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
      }}
    >
      <mesh position={[0, 0.55, 0]} visible={false}>
        <boxGeometry args={[0.95, 1.2, 0.95]} />
        <meshBasicMaterial />
      </mesh>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.3, 0.1, 24]} />
        <meshStandardMaterial color="#8a6848" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.24, 0.02]} castShadow>
        <boxGeometry args={[0.48, 0.14, 0.46]} />
        <meshStandardMaterial color="#d4b896" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.48, -0.16]} castShadow>
        <boxGeometry args={[0.48, 0.36, 0.09]} />
        <meshStandardMaterial color="#c9a882" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.28, 0.03]}>
        <boxGeometry args={[0.42, 0.05, 0.36]} />
        <meshStandardMaterial color="#e8c9a4" roughness={0.85} />
      </mesh>
    </group>
  );
}

function LoungeRoom({ onSeatTap }: { onSeatTap: (id: string) => void }) {
  const lamp = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (lamp.current) {
      lamp.current.intensity = 1.45 + Math.sin(clock.elapsedTime * 0.9) * 0.12;
    }
  });

  return (
    <group>
      <color attach="background" args={["#140e0c"]} />
      <fog attach="fog" args={["#241810", 18, 36]} />

      <ambientLight intensity={0.62} color="#ffe2c4" />
      <hemisphereLight args={["#ffe8d0", "#3a2818", 0.5]} />
      <directionalLight
        position={[8, 8, 4]}
        intensity={0.7}
        color="#ffd4a8"
        castShadow
      />
      <pointLight
        ref={lamp}
        position={[-1.2, 2.6, -2.4]}
        intensity={1.5}
        distance={18}
        decay={2}
        color="#ffc078"
      />
      <pointLight
        position={[3.4, 2.0, 1.2]}
        intensity={0.7}
        distance={11}
        color="#ffb878"
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[11.8, 9.4]} />
        <meshStandardMaterial color="#b8956e" roughness={0.92} metalness={0.03} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0.15]}>
        <planeGeometry args={[7.2, 5.6]} />
        <meshStandardMaterial color="#9a7a58" roughness={0.96} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.15]}>
        <planeGeometry args={[5.0, 3.8]} />
        <meshStandardMaterial color="#cbb08a" roughness={1} />
      </mesh>

      <mesh position={[0, 1.7, -4.72]} receiveShadow>
        <boxGeometry args={[11.8, 3.5, 0.14]} />
        <meshStandardMaterial color="#e8d8c0" roughness={0.82} />
      </mesh>
      <mesh position={[-5.72, 1.7, -0.15]} receiveShadow>
        <boxGeometry args={[0.14, 3.5, 9.2]} />
        <meshStandardMaterial color="#e0d0b8" roughness={0.84} />
      </mesh>
      <mesh position={[5.72, 1.7, -3.2]} receiveShadow>
        <boxGeometry args={[0.14, 3.5, 2.8]} />
        <meshStandardMaterial color="#e0d0b8" roughness={0.84} />
      </mesh>
      <mesh position={[-0.3, 0.5, 4.55]} receiveShadow>
        <boxGeometry args={[10.2, 1.05, 0.12]} />
        <meshStandardMaterial color="#d8c4a8" roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.35, -1.8]}>
        <boxGeometry args={[11.8, 0.1, 5.4]} />
        <meshStandardMaterial color="#d4c0a4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.22, -2.2]}>
        <boxGeometry args={[7.5, 0.04, 0.22]} />
        <meshBasicMaterial color="#ffd7a8" toneMapped={false} />
      </mesh>

      {/* Window — open to dark space only (no Earth plate) */}
      <mesh position={[-0.4, 1.65, -4.64]}>
        <planeGeometry args={[6.4, 2.4]} />
        <meshBasicMaterial color="#050814" toneMapped={false} />
      </mesh>
      {[-2.6, -0.4, 1.8].map((x) => (
        <mesh key={x} position={[x, 1.65, -4.62]}>
          <boxGeometry args={[0.07, 2.5, 0.08]} />
          <meshStandardMaterial
            color="#8a6a48"
            roughness={0.55}
            metalness={0.18}
          />
        </mesh>
      ))}
      <mesh position={[-0.4, 0.42, -4.25]}>
        <boxGeometry args={[6.6, 0.12, 0.55]} />
        <meshStandardMaterial color="#c4a888" roughness={0.7} />
      </mesh>

      {SEATS.map((seat) => (
        <WarmChair key={seat.id} seat={seat} onTap={onSeatTap} />
      ))}

      <mesh position={[4.65, 0.55, -0.35]} castShadow>
        <boxGeometry args={[0.9, 1.1, 2.4]} />
        <meshStandardMaterial color="#c4a888" roughness={0.75} />
      </mesh>
      <mesh position={[4.5, 1.15, -0.35]}>
        <boxGeometry args={[0.08, 0.7, 1.5]} />
        <meshBasicMaterial color="#f0c090" toneMapped={false} />
      </mesh>
      <pointLight
        position={[4.2, 1.2, -0.35]}
        intensity={0.6}
        distance={4.5}
        color="#ffc878"
      />

      <mesh position={[4.55, 0.35, -3.35]}>
        <cylinderGeometry args={[0.22, 0.26, 0.7, 16]} />
        <meshStandardMaterial color="#6a4a32" roughness={0.7} />
      </mesh>
      <mesh position={[4.55, 0.85, -3.35]}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshBasicMaterial color="#ffd090" toneMapped={false} />
      </mesh>
      <pointLight
        position={[4.55, 0.9, -3.35]}
        intensity={0.85}
        distance={3.6}
        color="#ffc070"
      />

      <mesh position={[-4.55, 0.25, -0.2]}>
        <cylinderGeometry args={[0.28, 0.32, 0.5, 16]} />
        <meshStandardMaterial color="#7a5a40" roughness={0.8} />
      </mesh>
      <mesh position={[-4.55, 0.62, -0.2]}>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color="#5a7a48" roughness={0.9} />
      </mesh>
    </group>
  );
}

function LoungeScene({
  onSitHud,
  sitRequest,
  standRequest,
  seatTapId,
  onSeatTap,
  sitting,
  vista,
  side,
}: WalkerProps & {
  onSeatTap: (id: string) => void;
  vista: SitVista;
  side: SitSide;
}) {
  return (
    <>
      {sitting ? (
        <SitSpaceView vista={vista} side={side} />
      ) : (
        <LoungeRoom onSeatTap={onSeatTap} />
      )}
      <PodWalker
        onSitHud={onSitHud}
        sitRequest={sitRequest}
        standRequest={standRequest}
        seatTapId={seatTapId}
        sitting={sitting}
      />
      <LoungePeers hidden={sitting} />
    </>
  );
}

type Props = {
  visible: boolean;
  onExit: () => void;
  onSittingChange?: (sitting: boolean) => void;
};

export function PodInterior({ visible, onExit, onSittingChange }: Props) {
  const [sitHud, setSitHud] = useState<SitHud>({
    nearSeat: false,
    sitting: false,
    seatLabel: null,
    vista: "sun",
    side: "left",
  });
  const [sitRequest, setSitRequest] = useState(0);
  const [standRequest, setStandRequest] = useState(0);
  const [seatTapId, setSeatTapId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    getPresenceRoom()?.publishLounge([0.2, 0.6], "idle");
    return () => {
      getPresenceRoom()?.clearLounge();
      onSittingChange?.(false);
    };
  }, [visible, onSittingChange]);

  useEffect(() => {
    onSittingChange?.(sitHud.sitting);
  }, [sitHud.sitting, onSittingChange]);

  const onSitHud = useCallback((hud: SitHud) => {
    setSitHud((prev) =>
      prev.nearSeat === hud.nearSeat &&
      prev.sitting === hud.sitting &&
      prev.seatLabel === hud.seatLabel &&
      prev.vista === hud.vista &&
      prev.side === hud.side
        ? prev
        : hud,
    );
  }, []);

  const onSeatTap = useCallback((id: string) => {
    setSeatTapId(id);
    window.setTimeout(() => setSeatTapId(null), 50);
  }, []);

  if (!visible) return null;

  const sitting = sitHud.sitting;

  return (
    <div className="absolute inset-0 z-40 animate-fade-in bg-[#140e0c]">
      <Canvas
        className="absolute inset-0 h-full w-full touch-none"
        camera={{
          position: sitting ? [8, 5, 14] : [9.2, 5.4, 7.4],
          fov: sitting ? 50 : 42,
          near: 0.05,
          far: sitting ? 2500 : 70,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        dpr={[1, 1.75]}
        shadows={!sitting}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color(sitting ? "#05060f" : "#140e0c"));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          if (!sitting) camera.lookAt(0.2, 0.85, -0.4);
        }}
      >
        <LoungeScene
          onSitHud={onSitHud}
          sitRequest={sitRequest}
          standRequest={standRequest}
          seatTapId={seatTapId}
          onSeatTap={onSeatTap}
          sitting={sitting}
          vista={sitHud.vista}
          side={sitHud.side}
        />
      </Canvas>

      {!sitting && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#140e0c]/35 via-transparent to-[#140e0c]/15" />
      )}

      {!sitting && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5">
          <div>
            <p className="font-display text-lg text-[#f3e6d4]">라운지 포드</p>
            <p className="mt-1 font-sans text-xs text-[#c8b8a0]">
              걷기 · 의자 탭/E로 앉기
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {sitting ? (
          <button
            type="button"
            onClick={() => setStandRequest((n) => n + 1)}
            className="pointer-events-auto animate-fade-in rounded-full border border-white/30 bg-[#0a1018]/75 px-6 py-3 font-sans text-sm tracking-wide text-[#f2f5f8] backdrop-blur-sm transition hover:border-white/50"
          >
            일어나기
          </button>
        ) : (
          <>
            {sitHud.nearSeat && (
              <button
                type="button"
                onClick={() => setSitRequest((n) => n + 1)}
                className="pointer-events-auto animate-fade-in rounded-full border border-[#e8d4b8]/45 bg-[#3a2a1c]/85 px-5 py-2.5 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/65"
              >
                앉기
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className="pointer-events-auto rounded-full border border-[#e8d4b8]/35 bg-[#2a2018]/8 px-6 py-3 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d4b8]"
            >
              우주로 나가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
