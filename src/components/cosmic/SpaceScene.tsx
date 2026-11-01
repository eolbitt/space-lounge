"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { LoungeBackdrop } from "./LoungeBackdrop";
import { LoungeObjects } from "./LoungeObjects";
import { Visitors } from "./Visitors";
import { PlayerController } from "./PlayerController";
import type { LoungeAction } from "@/lib/constants";

type Props = {
  entered: boolean;
  action: LoungeAction;
  onHeart?: (payload: {
    visitorId: string;
    screenHint: { x: number; y: number };
  }) => void;
  onPeerCount?: (count: number) => void;
};

export function SpaceScene({
  entered,
  action,
  onHeart,
  onPeerCount,
}: Props) {
  const playerRef = useRef<THREE.Group>(null);

  return (
    <Canvas
      className="absolute inset-0 h-full w-full touch-none"
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.2, 14], fov: 50, near: 0.1, far: 400 }}
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

        <PlayerController
          playerRef={playerRef}
          action={action}
          entered={entered}
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
