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

/** White cocoon cabin floor — open center for walking around the table */
const FLOOR = {
  minX: -3.8,
  maxX: 3.8,
  minZ: -3.4,
  maxZ: 3.2,
} as const;

const WALK_SPEED = 2.2;
const FLOOR_Y = 0;
const AVATAR_SCALE = 2.55;
const PEER_SCALE = 2.35;
const SIT_REACH = 1.55;

type SitVista = "earth" | "sun";
type SitSide = "left" | "right";

type Seat = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  sitY: number;
  facing: number;
  /** Fullscreen sit look — left chair → Earth; right chair → sun */
  vista: SitVista;
  /** Left/right chair — biases sit camera */
  side: SitSide;
};

/** Two glowing chairs facing each other across the pedestal table */
const SEATS: Seat[] = [
  {
    id: "c0",
    x: -1.55,
    z: 0.15,
    yaw: Math.PI * 0.5,
    sitY: 0.28,
    facing: 1,
    vista: "earth",
    side: "left",
  },
  {
    id: "c1",
    x: 1.55,
    z: 0.15,
    yaw: -Math.PI * 0.5,
    sitY: 0.28,
    facing: -1,
    vista: "sun",
    side: "right",
  },
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
  const facingRef = useRef(1);
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
  const camTarget = useRef(new THREE.Vector3(0, 0.7, -0.6));
  const camPos = useRef(new THREE.Vector3(5.6, 3.9, 4.8));

  useWalkKeys(!sittingProp);

  const sitOn = useCallback((seat: Seat) => {
    sitting.current = true;
    seatId.current = seat.id;
    vistaRef.current = seat.vista;
    sideRef.current = seat.side;
    pos.current.set(seat.x, seat.sitY, seat.z);
    facingRef.current = seat.facing;
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
        // Hard snap left/right — no facing lerp
        let faceTarget = facingRef.current;
        if (Math.abs(vel.current.z) >= Math.abs(vel.current.x) * 0.55) {
          faceTarget = vel.current.z > 0 ? -1 : 1;
        } else if (Math.abs(vel.current.x) > 0.12) {
          faceTarget = vel.current.x > 0 ? 1 : -1;
        }
        if (faceTarget !== facingRef.current) {
          facingRef.current = faceTarget;
          setFacing(faceTarget);
        }
      } else {
        setState("idle");
      }

      camTarget.current.set(
        pos.current.x * 0.22,
        0.72,
        pos.current.z * 0.28 - 0.85,
      );
      const desired = new THREE.Vector3(
        5.4 + pos.current.x * 0.1,
        3.85,
        4.6 + pos.current.z * 0.18,
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

/** Soft blob chair with warm yellow LED trim */
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
      <mesh position={[0, 0.5, 0]} visible={false}>
        <boxGeometry args={[1.05, 1.15, 1.05]} />
        <meshBasicMaterial />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, 0.28, 0.04]} castShadow>
        <sphereGeometry args={[0.42, 28, 20]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.22, 0.04]} scale={[1.05, 0.55, 1.05]} castShadow>
        <sphereGeometry args={[0.4, 24, 16]} />
        <meshStandardMaterial color="#efece6" roughness={0.82} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.58, -0.22]} scale={[0.95, 1.05, 0.55]} castShadow>
        <sphereGeometry args={[0.38, 24, 16]} />
        <meshStandardMaterial color="#f2f0ec" roughness={0.76} />
      </mesh>
      {/* Arm rests */}
      <mesh position={[-0.34, 0.36, 0.02]} scale={[0.38, 0.42, 0.7]} castShadow>
        <sphereGeometry args={[0.28, 18, 14]} />
        <meshStandardMaterial color="#f0eeea" roughness={0.8} />
      </mesh>
      <mesh position={[0.34, 0.36, 0.02]} scale={[0.38, 0.42, 0.7]} castShadow>
        <sphereGeometry args={[0.28, 18, 14]} />
        <meshStandardMaterial color="#f0eeea" roughness={0.8} />
      </mesh>
      {/* Yellow LED trim — arm curve */}
      <mesh position={[-0.4, 0.4, 0.02]} rotation={[Math.PI / 2, 0, 0.15]}>
        <torusGeometry args={[0.22, 0.018, 10, 28, Math.PI * 1.15]} />
        <meshBasicMaterial color="#ffcc55" toneMapped={false} />
      </mesh>
      <mesh position={[0.4, 0.4, 0.02]} rotation={[Math.PI / 2, 0, -0.15]}>
        <torusGeometry args={[0.22, 0.018, 10, 28, Math.PI * 1.15]} />
        <meshBasicMaterial color="#ffcc55" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.62, -0.28]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[0.26, 0.016, 10, 32, Math.PI]} />
        <meshBasicMaterial color="#ffd266" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.45, 0.1]} intensity={0.35} distance={2.2} color="#ffc45a" />
    </group>
  );
}

function GlowingPedestalTable() {
  const glow = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (glow.current) {
      glow.current.intensity = 0.85 + Math.sin(clock.elapsedTime * 1.4) * 0.12;
    }
  });
  return (
    <group position={[0, 0, 0.15]}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.36, 28]} />
        <meshStandardMaterial color="#f2f0ec" roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.06, 32]} />
        <meshStandardMaterial color="#f7f5f1" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Yellow ring under tabletop */}
      <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.028, 12, 48]} />
        <meshBasicMaterial color="#ffc44a" toneMapped={false} />
      </mesh>
      <mesh position={[0.08, 0.44, 0.05]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
        <meshStandardMaterial color="#f8f6f2" roughness={0.5} />
      </mesh>
      <mesh position={[0.08, 0.49, 0.05]}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </mesh>
      <pointLight ref={glow} position={[0, 0.5, 0]} intensity={0.9} distance={3.5} color="#ffc45a" />
    </group>
  );
}

function CeilingStar() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (light.current) {
      light.current.intensity = 0.7 + Math.sin(clock.elapsedTime * 1.1) * 0.15;
    }
  });
  return (
    <group position={[0, 3.15, -1.85]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 5]} />
        <meshBasicMaterial color="#ffd266" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 5]}>
        <circleGeometry args={[0.16, 5]} />
        <meshBasicMaterial color="#ffe08a" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={light} intensity={0.8} distance={6} color="#ffd070" />
    </group>
  );
}

function FloorOvalRing() {
  return (
    <group position={[0, 0.015, 0.1]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.35, 1, 1]}>
        <torusGeometry args={[1.85, 0.035, 12, 64]} />
        <meshBasicMaterial color="#ffc44a" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.35, 1, 1]} position={[0, -0.004, 0]}>
        <torusGeometry args={[1.85, 0.055, 10, 64]} />
        <meshBasicMaterial color="#ffb020" transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallShelves() {
  return (
    <group position={[-3.15, 1.35, -0.4]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.7, 0.07, 0.42]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.25, 0]} castShadow>
        <boxGeometry args={[0.7, 0.07, 0.42]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.6} />
      </mesh>
      {/* Plant */}
      <mesh position={[-0.08, 0.48, 0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.12, 12]} />
        <meshStandardMaterial color="#f7f5f1" roughness={0.55} />
      </mesh>
      <mesh position={[-0.08, 0.62, 0]}>
        <sphereGeometry args={[0.12, 12, 10]} />
        <meshStandardMaterial color="#6a9a58" roughness={0.85} />
      </mesh>
      <mesh position={[-0.02, 0.7, 0.04]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial color="#7aab64" roughness={0.85} />
      </mesh>
      {/* Egg decor */}
      <mesh position={[0.12, -0.05, 0]} scale={[0.7, 1, 0.7]}>
        <sphereGeometry args={[0.11, 14, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
    </group>
  );
}

function WallDisplay() {
  return (
    <group position={[3.05, 1.55, -0.35]} rotation={[0, -Math.PI / 2 + 0.08, 0]}>
      {/* Flat screen facing room center */}
      <mesh>
        <planeGeometry args={[1.15, 0.78]} />
        <meshBasicMaterial color="#0c1018" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[1.22, 0.85]} />
        <meshStandardMaterial color="#1a1e28" roughness={0.45} metalness={0.15} />
      </mesh>
      {/* Yellow frame strips */}
      <mesh position={[0, 0.41, 0.01]}>
        <boxGeometry args={[1.2, 0.03, 0.02]} />
        <meshBasicMaterial color="#ffc44a" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.41, 0.01]}>
        <boxGeometry args={[1.2, 0.03, 0.02]} />
        <meshBasicMaterial color="#ffc44a" toneMapped={false} />
      </mesh>
      <mesh position={[-0.59, 0, 0.01]}>
        <boxGeometry args={[0.03, 0.85, 0.02]} />
        <meshBasicMaterial color="#ffc44a" toneMapped={false} />
      </mesh>
      <mesh position={[0.59, 0, 0.01]}>
        <boxGeometry args={[0.03, 0.85, 0.02]} />
        <meshBasicMaterial color="#ffc44a" toneMapped={false} />
      </mesh>
      <mesh position={[-0.35, 0.18, 0.02]}>
        <circleGeometry args={[0.055, 5]} />
        <meshBasicMaterial color="#ffd266" toneMapped={false} />
      </mesh>
      <mesh position={[0.2, -0.08, 0.02]}>
        <circleGeometry args={[0.16, 24]} />
        <meshBasicMaterial color="#3a6a98" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 0.35]} intensity={0.35} distance={2.6} color="#ffc45a" />
    </group>
  );
}

function SpaceViewport() {
  const stars = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 48; i++) {
      pts.push([
        (Math.random() - 0.5) * 3.4,
        (Math.random() - 0.5) * 3.4,
        0.02,
      ]);
    }
    return pts;
  }, []);

  return (
    <group position={[0, 1.55, -3.55]}>
      {/* Recessed bezel */}
      <mesh position={[0, 0, -0.04]}>
        <ringGeometry args={[1.72, 1.95, 48]} />
        <meshStandardMaterial color="#eceae6" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <ringGeometry args={[1.58, 1.74, 48]} />
        <meshStandardMaterial color="#f6f4f0" roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* Space plate */}
      <mesh>
        <circleGeometry args={[1.7, 48]} />
        <meshBasicMaterial color="#050814" toneMapped={false} />
      </mesh>
      {stars.map((p, i) => (
        <mesh key={i} position={p}>
          <circleGeometry args={[0.012 + (i % 3) * 0.006, 8]} />
          <meshBasicMaterial color="#e8eef8" toneMapped={false} />
        </mesh>
      ))}
      {/* Soft Earth crescent in viewport */}
      <mesh position={[0.55, -0.15, 0.03]}>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial color="#1a3a68" toneMapped={false} />
      </mesh>
      <mesh position={[0.72, -0.05, 0.04]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color="#2a5a88" toneMapped={false} />
      </mesh>
      <mesh position={[0.85, 0.1, 0.05]}>
        <circleGeometry args={[0.22, 20]} />
        <meshBasicMaterial color="#c8d8e8" toneMapped={false} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function LoungeRoom({ onSeatTap }: { onSeatTap: (id: string) => void }) {
  return (
    <group>
      <color attach="background" args={["#e8e6e2"]} />
      <fog attach="fog" args={["#ebe8e4", 14, 28]} />

      <ambientLight intensity={0.85} color="#fff8ee" />
      <hemisphereLight args={["#ffffff", "#d8d0c4", 0.55]} />
      <directionalLight
        position={[4, 7, 3]}
        intensity={0.55}
        color="#fff4e4"
        castShadow
      />
      <pointLight position={[0, 2.8, 0.5]} intensity={0.7} distance={10} color="#ffe8c8" />
      <pointLight position={[0, 1.8, -2.8]} intensity={0.45} distance={7} color="#ffd090" />

      {/* Cocoon floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[4.6, 64]} />
        <meshStandardMaterial color="#f2f0ec" roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0.05]} receiveShadow>
        <circleGeometry args={[3.2, 64]} />
        <meshStandardMaterial color="#f7f5f1" roughness={0.95} />
      </mesh>

      {/* Inner cocoon shell — open toward +Z camera */}
      <mesh position={[0, 1.6, -0.2]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[4.55, 4.55, 3.6, 48, 1, true, Math.PI * 0.18, Math.PI * 1.64]} />
        <meshStandardMaterial
          color="#f4f2ee"
          roughness={0.88}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Soft dome ceiling */}
      <mesh position={[0, 3.35, -0.15]}>
        <sphereGeometry args={[4.55, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
        <meshStandardMaterial color="#f6f4f0" roughness={0.9} side={THREE.BackSide} />
      </mesh>
      {/* Rear bulkhead with viewport recess */}
      <mesh position={[0, 1.55, -3.72]}>
        <circleGeometry args={[2.35, 48]} />
        <meshStandardMaterial color="#efede9" roughness={0.82} side={THREE.DoubleSide} />
      </mesh>

      <SpaceViewport />
      <CeilingStar />
      <FloorOvalRing />
      <GlowingPedestalTable />
      <WallShelves />
      <WallDisplay />

      {SEATS.map((seat) => (
        <WarmChair key={seat.id} seat={seat} onTap={onSeatTap} />
      ))}
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
    <div className="absolute inset-0 z-40 animate-fade-in bg-[#e8e6e2]">
      <Canvas
        className="absolute inset-0 h-full w-full touch-none"
        camera={{
          position: sitting ? [8, 5, 14] : [5.6, 3.9, 4.8],
          fov: sitting ? 50 : 44,
          near: 0.05,
          far: sitting ? 2500 : 70,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        dpr={[1, 1.75]}
        shadows={!sitting}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color(sitting ? "#05060f" : "#e8e6e2"));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          if (!sitting) camera.lookAt(0, 0.7, -0.6);
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#d8d4cc]/25 via-transparent to-white/10" />
      )}

      {!sitting && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5">
          <div>
            <p className="font-display text-lg text-[#2a2a28]">라운지 포드</p>
            <p className="mt-1 font-sans text-xs text-[#6a6860]">
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
                className="pointer-events-auto animate-fade-in rounded-full border border-[#ffc44a]/55 bg-[#fff8ea]/9 px-5 py-2.5 font-sans text-sm tracking-wide text-[#3a3428] backdrop-blur-sm transition hover:border-[#ffb020]"
              >
                앉기
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className="pointer-events-auto rounded-full border border-[#c8c4bc]/70 bg-white/85 px-6 py-3 font-sans text-sm tracking-wide text-[#2a2a28] backdrop-blur-sm transition hover:border-[#ffc44a]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc44a]"
            >
              우주로 나가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
