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
};

export function SpaceScene({ entered, action }: Props) {
  const playerRef = useRef<THREE.Group>(null);

  return (
    <Canvas
      className="absolute inset-0 h-full w-full"
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.4, 8.5], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color("#05060f"));
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.55} color="#c8d4e8" />
        <directionalLight
          position={[4, 8, 6]}
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

        {entered && <Visitors playerRef={playerRef} />}

        {/* Soft earth glow from below */}
        <pointLight
          position={[0.5, -3.5, -2]}
          intensity={1.1}
          distance={28}
          color="#6a9ad8"
        />
        <pointLight
          position={[-2, -2.5, 1]}
          intensity={0.35}
          distance={12}
          color="#ffb060"
        />
      </Suspense>
    </Canvas>
  );
}
