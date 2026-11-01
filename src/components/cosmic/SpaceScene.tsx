"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { LoungeBackdrop } from "./LoungeBackdrop";
import { LoungeObjects } from "./LoungeObjects";
import { PlanetFlags } from "./PlanetFlags";
import { Visitors } from "./Visitors";
import { PlayerController } from "./PlayerController";
import type { LoungeAction } from "@/lib/constants";
import { getPresenceRoom } from "@/lib/realtime";
import type { PlanetFlag, PlanetSite } from "@/lib/planetFlags";

type Props = {
  entered: boolean;
  action: LoungeAction;
  onHeart?: (payload: {
    visitorId: string;
    screenHint: { x: number; y: number };
  }) => void;
  onPeerCount?: (count: number) => void;
  onNearPod?: (near: boolean) => void;
  onNearPlanet?: (site: PlanetSite | null) => void;
  onSelectPlanet?: (site: PlanetSite) => void;
};

export function SpaceScene({
  entered,
  action,
  onHeart,
  onPeerCount,
  onNearPod,
  onNearPlanet,
  onSelectPlanet,
}: Props) {
  const playerRef = useRef<THREE.Group>(null);
  const [flags, setFlags] = useState<Map<string, PlanetFlag>>(
    () => new Map(),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!entered) return;
    const room = getPresenceRoom();
    if (!room) return;
    return room.subscribe({
      onFlags: (next) => setFlags(new Map(next)),
    });
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    const id = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, [entered]);

  return (
    <Canvas
      className="absolute inset-0 h-full w-full touch-none"
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.2, 14], fov: 50, near: 0.05, far: 2500 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color("#05060f"));
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} color="#c8d4e8" />
        <directionalLight
          position={[10, 14, 8]}
          intensity={0.5}
          color="#fff0d0"
        />
        <hemisphereLight args={["#6a8498", "#0a1018", 0.35]} />

        <LoungeBackdrop />
        <LoungeObjects />
        <PlanetFlags
          flags={flags}
          now={now}
          onSelectPlanet={onSelectPlanet}
        />

        <PlayerController
          playerRef={playerRef}
          action={action}
          entered={entered}
          onNearPod={onNearPod}
          onNearPlanet={onNearPlanet}
        />

        {entered && (
          <Visitors
            playerRef={playerRef}
            onHeart={onHeart}
            onPeerCount={onPeerCount}
          />
        )}

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
    </Canvas>
  );
}
