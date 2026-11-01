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
};

export function SpaceScene({ entered, action, onHeart }: Props) {
  const playerRef = useRef<THREE.Group>(null);

  return (
    <Canvas
      className="absolute inset-0 h-full w-full"
      dpr={[1, 1.75]}
      camera={{ position: [0, 2, 12], fov: 46, near: 0.1, far: 320 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color("#05060f"));
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.55} color="#c8d4e8" />
        <directionalLight
          position={[8, 12, 8]}
          intensity={0.45}
          color="#fff0d0"
        />

        <LoungeBackdrop />
        <LoungeObjects />

        <PlayerController
          playerRef={playerRef}
          action={action}
          entered={entered}
        />

        {entered && (
          <Visitors playerRef={playerRef} onHeart={onHeart} />
        )}

        <pointLight
          position={[1.5, -5, -4]}
          intensity={1.2}
          distance={40}
          color="#6a9ad8"
        />
        <pointLight
          position={[-6, -2, 2]}
          intensity={0.4}
          distance={18}
          color="#ffb060"
        />
      </Suspense>
    </Canvas>
  );
}
