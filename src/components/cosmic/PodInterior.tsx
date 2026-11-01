"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
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

const PLAYER_R = 0.32;
const WALK_SPEED = 2.2;
const FLOOR_Y = 0;
/** Chair-proportional astronaut — fill the seat, not a figurine */
const AVATAR_SCALE = 2.95;
const PEER_SCALE = 2.7;
const SIT_REACH = 1.75;

type Seat = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  /** Sit root Y (cushion) */
  sitY: number;
  facing: number;
};

/** Chairs pushed to edges — leave a wide central floor */
const SEATS: Seat[] = [
  { id: "c0", x: -3.7, z: 2.85, yaw: 0.45, sitY: 0.32, facing: 1 },
  { id: "c1", x: -1.85, z: 3.35, yaw: 0.08, sitY: 0.32, facing: 1 },
  { id: "c2", x: 3.45, z: 2.7, yaw: -0.55, sitY: 0.32, facing: -1 },
  { id: "c3", x: 1.85, z: -3.35, yaw: Math.PI * 0.9, sitY: 0.32, facing: 1 },
  { id: "c4", x: -3.35, z: -3.2, yaw: Math.PI * 1.1, sitY: 0.32, facing: -1 },
];

type CircleHit = { kind: "circle"; x: number; z: number; r: number };
type BoxHit = {
  kind: "box";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
type Hit = CircleHit | BoxHit;

const COLLIDERS: Hit[] = [
  { kind: "box", minX: -5.95, maxX: -5.55, minZ: -4.8, maxZ: 4.6 },
  { kind: "box", minX: 5.55, maxX: 5.95, minZ: -4.8, maxZ: 4.6 },
  { kind: "box", minX: -5.9, maxX: 5.9, minZ: -4.95, maxZ: -4.55 },
  { kind: "box", minX: -5.9, maxX: 5.9, minZ: 4.35, maxZ: 4.75 },
  ...SEATS.map((s) => ({
    kind: "circle" as const,
    x: s.x,
    z: s.z,
    r: 0.45,
  })),
  { kind: "box", minX: 4.05, maxX: 5.35, minZ: -1.55, maxZ: 1.55 },
  { kind: "box", minX: -4.0, maxX: 2.0, minZ: -4.45, maxZ: -3.95 },
  { kind: "circle", x: 4.55, z: -3.35, r: 0.4 },
  { kind: "circle", x: -4.55, z: -0.2, r: 0.38 },
];

function circleHitsBox(x: number, z: number, r: number, b: BoxHit) {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

function blocked(x: number, z: number, r = PLAYER_R): boolean {
  if (
    x - r < FLOOR.minX ||
    x + r > FLOOR.maxX ||
    z - r < FLOOR.minZ ||
    z + r > FLOOR.maxZ
  ) {
    return true;
  }
  for (const h of COLLIDERS) {
    if (h.kind === "circle") {
      const dx = x - h.x;
      const dz = z - h.z;
      if (dx * dx + dz * dz < (r + h.r) * (r + h.r)) return true;
    } else if (circleHitsBox(x, z, r, h)) {
      return true;
    }
  }
  return false;
}

function tryMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
): [number, number] {
  const nx = x + dx;
  const nz = z + dz;
  if (!blocked(nx, nz)) return [nx, nz];
  if (!blocked(x + dx, z)) return [x + dx, z];
  if (!blocked(x, z + dz)) return [x, z + dz];
  return [x, z];
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
};

type WalkerProps = {
  onSitHud: (hud: SitHud) => void;
  sitRequest: number;
  standRequest: number;
  seatTapId: string | null;
};

/**
 * Elevated 3/4 follow cam + walk / sit.
 * Corner vantage (not a flat side cutaway) so floor depth reads clearly.
 */
function PodWalker({
  onSitHud,
  sitRequest,
  standRequest,
  seatTapId,
}: WalkerProps) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [state, setState] = useState<AvatarState>("idle");
  const [facing, setFacing] = useState(1);
  const pos = useRef(new THREE.Vector3(-0.2, FLOOR_Y, 0.8));
  const sitting = useRef(false);
  const seatId = useRef<string | null>(null);
  const nearId = useRef<string | null>(null);
  const publishAcc = useRef(0);
  const lastSitReq = useRef(0);
  const lastStandReq = useRef(0);
  const lastTap = useRef<string | null>(null);
  const eWasDown = useRef(false);
  const wish = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3(0.2, 0.85, -0.4));
  /** Elevated 3/4 — outside +X/+Z corner looking into the lounge */
  const camPos = useRef(new THREE.Vector3(9.2, 5.4, 7.4));

  useWalkKeys(true);

  const sitOn = useCallback((seat: Seat) => {
    sitting.current = true;
    seatId.current = seat.id;
    pos.current.set(seat.x, seat.sitY, seat.z);
    setFacing(seat.facing);
    setState("rest");
  }, []);

  const standUp = useCallback(() => {
    if (!sitting.current) return;
    const seat = SEATS.find((s) => s.id === seatId.current);
    sitting.current = false;
    seatId.current = null;
    if (seat) {
      // Step slightly toward room center so we clear the chair collider
      const ox = -Math.sin(seat.yaw) * 0.7;
      const oz = -Math.cos(seat.yaw) * 0.7;
      let nx = seat.x + ox;
      let nz = seat.z + oz;
      if (blocked(nx, nz)) {
        nx = seat.x - ox * 0.5;
        nz = seat.z - oz * 0.5;
      }
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

    // External sit / stand / tap requests from HUD & chair meshes
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
          if (d <= SIT_REACH + 0.35 || sitting.current) {
            if (sitting.current) standUp();
            sitOn(seat);
          } else {
            nearId.current = seat.id;
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

    // W/S = ±Z (window/back), A/D = ±X
    let mx = 0;
    let mz = 0;
    if (keys.has("w") || keys.has("arrowup")) mz -= 1;
    if (keys.has("s") || keys.has("arrowdown")) mz += 1;
    if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
    if (keys.has("d") || keys.has("arrowright")) mx += 1;
    if (touchMoveActive()) {
      mz -= touchMove.y;
      mx += touchMove.x;
    }

    wish.current.set(0, 0, 0);
    if (mx !== 0 || mz !== 0) {
      wish.current.set(mx, 0, mz);
      if (wish.current.lengthSq() > 1e-6) wish.current.normalize();
    }

    const moving = wish.current.lengthSq() > 1e-4;
    if (sitting.current) {
      if (moving) standUp();
      else {
        setState("rest");
        const seat = SEATS.find((s) => s.id === seatId.current);
        if (seat) pos.current.set(seat.x, seat.sitY, seat.z);
      }
    }

    if (!sitting.current) {
      if (moving) {
        const step = WALK_SPEED * clamped;
        const [nx, nz] = tryMove(
          pos.current.x,
          pos.current.z,
          wish.current.x * step,
          wish.current.z * step,
        );
        pos.current.x = nx;
        pos.current.z = nz;
        pos.current.y = FLOOR_Y;
        setState("move");
        if (Math.abs(wish.current.z) > 0.08) {
          setFacing(wish.current.z > 0 ? -1 : 1);
        }
      } else {
        setState("idle");
      }
    }

    g.position.copy(pos.current);

    const near = sitting.current
      ? null
      : nearestSeat(pos.current.x, pos.current.z);
    nearId.current = near?.seat.id ?? null;
    onSitHud({
      nearSeat: Boolean(near) || sitting.current,
      sitting: sitting.current,
      seatLabel: sitting.current
        ? "앉아 있어요"
        : near
          ? "의자 근처"
          : null,
    });

    // Elevated 3/4 walk cam; when seated, aim through the −Z window at space
    if (sitting.current) {
      camTarget.current.set(
        pos.current.x * 0.2 - 0.35,
        1.55,
        -4.35,
      );
      const desiredSit = new THREE.Vector3(
        pos.current.x + 3.6,
        2.55,
        Math.max(pos.current.z + 2.8, 1.2),
      );
      camPos.current.lerp(desiredSit, 1 - Math.pow(0.008, clamped));
    } else {
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
    }
    camera.position.copy(camPos.current);
    camera.lookAt(camTarget.current);

    publishAcc.current += clamped;
    if (publishAcc.current > 0.12) {
      publishAcc.current = 0;
      getPresenceRoom()?.publishLounge(
        [pos.current.x, pos.current.z],
        sitting.current ? "rest" : moving ? "move" : "idle",
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
      />
    </group>
  );
}

/** Real WebSocket peers in the lounge only — no mock avatars. */
function LoungePeers() {
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

  return (
    <group>
      {bodies.map((b) => (
        <group key={b.id} position={[b.x, b.y, b.z]}>
          <Astronaut state={b.state} scale={PEER_SCALE} facing={b.facing} />
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

function LoungeScene({
  onSitHud,
  sitRequest,
  standRequest,
  seatTapId,
  onSeatTap,
}: WalkerProps & { onSeatTap: (id: string) => void }) {
  const earth = useTexture("/assets/objects/earth.png") as THREE.Texture;
  earth.colorSpace = THREE.SRGBColorSpace;
  const lamp = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (lamp.current) {
      lamp.current.intensity = 1.45 + Math.sin(clock.elapsedTime * 0.9) * 0.12;
    }
  });

  return (
    <>
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

      {/* Floor — expanded open center */}
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

      {/* Window wall (−Z) */}
      <mesh position={[0, 1.7, -4.72]} receiveShadow>
        <boxGeometry args={[11.8, 3.5, 0.14]} />
        <meshStandardMaterial color="#e8d8c0" roughness={0.82} />
      </mesh>
      {/* Far left wall (−X) */}
      <mesh position={[-5.72, 1.7, -0.15]} receiveShadow>
        <boxGeometry args={[0.14, 3.5, 9.2]} />
        <meshStandardMaterial color="#e0d0b8" roughness={0.84} />
      </mesh>
      {/* Camera-side (+X): partial cutaway stub near window */}
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

      {/* Window */}
      <mesh position={[-0.4, 1.65, -4.64]}>
        <planeGeometry args={[6.4, 2.4]} />
        <meshBasicMaterial color="#070c14" toneMapped={false} />
      </mesh>
      <mesh position={[-0.4, 1.65, -4.6]} scale={[4.6, 4.6, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={earth}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-0.4, 1.65, -4.58]}>
        <planeGeometry args={[6.5, 2.5]} />
        <meshBasicMaterial
          color="#ffb070"
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
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

      {/* Console — pushed to side wall */}
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

      <PodWalker
        onSitHud={onSitHud}
        sitRequest={sitRequest}
        standRequest={standRequest}
        seatTapId={seatTapId}
      />
      <LoungePeers />
    </>
  );
}

type Props = {
  visible: boolean;
  onExit: () => void;
};

export function PodInterior({ visible, onExit }: Props) {
  const [sitHud, setSitHud] = useState<SitHud>({
    nearSeat: false,
    sitting: false,
    seatLabel: null,
  });
  const [sitRequest, setSitRequest] = useState(0);
  const [standRequest, setStandRequest] = useState(0);
  const [seatTapId, setSeatTapId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    getPresenceRoom()?.publishLounge([0.2, 0.6], "idle");
    return () => {
      getPresenceRoom()?.clearLounge();
    };
  }, [visible]);

  const onSeatTap = useCallback((id: string) => {
    setSeatTapId(id);
    window.setTimeout(() => setSeatTapId(null), 50);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 animate-fade-in bg-[#140e0c]">
      <Canvas
        className="absolute inset-0 h-full w-full touch-none"
        camera={{ position: [9.2, 5.4, 7.4], fov: 42, near: 0.05, far: 70 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.75]}
        shadows
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color("#140e0c"));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          camera.lookAt(0.2, 0.85, -0.4);
        }}
      >
        <LoungeScene
          onSitHud={setSitHud}
          sitRequest={sitRequest}
          standRequest={standRequest}
          seatTapId={seatTapId}
          onSeatTap={onSeatTap}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#140e0c]/35 via-transparent to-[#140e0c]/15" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5">
        <div>
          <p className="font-display text-lg text-[#f3e6d4]">라운지 포드</p>
          <p className="mt-1 font-sans text-xs text-[#c8b8a0]">
            걷기 · 의자 탭/E로 앉기 · 가구는 지나갈 수 없어요
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 p-6">
        {sitHud.nearSeat && (
          <button
            type="button"
            onClick={() => {
              if (sitHud.sitting) setStandRequest((n) => n + 1);
              else setSitRequest((n) => n + 1);
            }}
            className="pointer-events-auto animate-fade-in rounded-full border border-[#e8d4b8]/45 bg-[#3a2a1c]/85 px-5 py-2.5 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/65"
          >
            {sitHud.sitting ? "일어나기" : "앉기"}
          </button>
        )}
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto rounded-full border border-[#e8d4b8]/35 bg-[#2a2018]/8 px-6 py-3 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d4b8]"
        >
          우주로 나가기
        </button>
      </div>
    </div>
  );
}
