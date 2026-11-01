"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { CelestialBodies } from "./CelestialBodies";
import { StarField } from "./StarField";
import { Visitors } from "./Visitors";
import { PlayerController, type PlayerMode } from "./PlayerController";
import type { CelestialBody } from "@/lib/celestial";
import type { MockVisitor } from "@/lib/presence";

type Props = {
  entered: boolean;
  mode: PlayerMode;
  orbitTarget: CelestialBody | null;
  onSelectBody: (body: CelestialBody) => void;
  onNearVisitor: (v: MockVisitor | null) => void;
};

export function SpaceScene({
  entered,
  mode,
  orbitTarget,
  onSelectBody,
  onNearVisitor,
}: Props) {
  const playerRef = useRef<THREE.Group>(null);

  return (
    <Canvas
      className="absolute inset-0 h-full w-full"
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.5, 28], fov: 55, near: 0.1, far: 400 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(new THREE.Color("#05070c"));
        scene.fog = new THREE.FogExp2("#070a12", 0.0085);
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.22} color="#8aa0b8" />
        <directionalLight
          position={[20, 30, 10]}
          intensity={0.35}
          color="#c8d8e8"
        />
        <hemisphereLight
          args={["#6a8498", "#0a1018", 0.45]}
        />

        <StarField />
        <Stars
          radius={160}
          depth={60}
          count={1800}
          factor={3.2}
          saturation={0}
          fade
          speed={0.15}
        />

        <CelestialBodies
          onSelect={onSelectBody}
          highlightedId={orbitTarget?.id ?? null}
        />

        <PlayerController
          playerRef={playerRef}
          mode={mode}
          orbitTarget={orbitTarget}
          entered={entered}
        />

        {entered && (
          <Visitors playerRef={playerRef} onNearChange={onNearVisitor} />
        )}

        {/* Soft nebula planes for atmosphere — teal/amber, not purple */}
        <mesh position={[-40, -20, -60]} rotation={[0.3, 0.4, 0]}>
          <planeGeometry args={[90, 50]} />
          <meshBasicMaterial
            color="#1a3a48"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[50, 15, -80]} rotation={[-0.2, -0.5, 0.1]}>
          <planeGeometry args={[70, 40]} />
          <meshBasicMaterial
            color="#3a2818"
            transparent
            opacity={0.1}
            depthWrite={false}
          />
        </mesh>
      </Suspense>
    </Canvas>
  );
}
