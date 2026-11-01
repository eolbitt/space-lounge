"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Quiet lounge interior — warm light + window to stars. No missions. */
function InteriorScene() {
  const lamp = useRef<THREE.PointLight>(null);

  const starGeo = useMemo(() => {
    const count = 400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = 3.2 + Math.random() * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (lamp.current) {
      lamp.current.intensity = 1.35 + Math.sin(clock.elapsedTime * 1.3) * 0.1;
    }
  });

  return (
    <>
      <color attach="background" args={["#241810"]} />
      <fog attach="fog" args={["#241810", 6, 14]} />
      <ambientLight intensity={0.55} color="#ffd9a8" />
      <pointLight
        ref={lamp}
        position={[0.15, 1.2, 0.2]}
        intensity={1.4}
        distance={10}
        color="#ffc878"
      />
      <pointLight position={[-1.4, 0.5, -0.6]} intensity={0.4} color="#7aa0c0" />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]} receiveShadow>
        <circleGeometry args={[3.4, 48]} />
        <meshStandardMaterial color="#3a2c22" roughness={0.92} metalness={0.04} />
      </mesh>

      {/* Back + side walls */}
      <mesh position={[0, 0.5, -2.3]}>
        <boxGeometry args={[5.8, 3.4, 0.14]} />
        <meshStandardMaterial color="#4a3a2e" roughness={0.88} />
      </mesh>
      <mesh position={[-2.6, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[4.4, 3.4, 0.14]} />
        <meshStandardMaterial color="#403228" roughness={0.88} />
      </mesh>
      <mesh position={[2.6, 0.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[4.4, 3.4, 0.14]} />
        <meshStandardMaterial color="#403228" roughness={0.88} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[5.8, 0.12, 4.6]} />
        <meshStandardMaterial color="#2e241c" roughness={0.9} />
      </mesh>

      {/* Window opening toward +Z */}
      <mesh position={[0, 0.55, 2.05]}>
        <boxGeometry args={[2.7, 1.8, 0.1]} />
        <meshStandardMaterial color="#1a1510" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* Deep space through window */}
      <mesh position={[0, 0.55, 2.2]}>
        <planeGeometry args={[2.4, 1.5]} />
        <meshBasicMaterial color="#070a14" />
      </mesh>
      <points geometry={starGeo}>
        <pointsMaterial
          size={0.035}
          color="#e8eef8"
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>

      {/* Seat */}
      <mesh position={[-0.75, -0.7, 0.15]}>
        <boxGeometry args={[0.95, 0.38, 0.95]} />
        <meshStandardMaterial color="#5a4330" roughness={0.82} />
      </mesh>
      <mesh position={[-0.75, -0.28, -0.2]}>
        <boxGeometry args={[0.95, 0.58, 0.16]} />
        <meshStandardMaterial color="#5a4330" roughness={0.82} />
      </mesh>

      {/* Soft table glow */}
      <mesh position={[0.55, -0.78, 0.35]}>
        <cylinderGeometry args={[0.35, 0.4, 0.45, 16]} />
        <meshStandardMaterial color="#4a3828" roughness={0.8} />
      </mesh>
      <pointLight position={[0.55, -0.3, 0.35]} intensity={0.5} distance={2.5} color="#ffb060" />
    </>
  );
}

type Props = {
  visible: boolean;
  onExit: () => void;
};

export function PodInterior({ visible, onExit }: Props) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 animate-fade-in bg-[#241810]">
      <Canvas
        className="absolute inset-0 h-full w-full"
        camera={{ position: [0, 0.2, 1.9], fov: 60, near: 0.05, far: 40 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color("#241810"));
          camera.lookAt(0, 0.2, 0);
        }}
      >
        <InteriorScene />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a120c]/55 via-transparent to-[#1a120c]/25" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5">
        <div>
          <p className="font-display text-lg text-[#f3e6d4]">라운지 포드</p>
          <p className="mt-1 font-sans text-xs text-[#c8b8a0]">
            조용한 안쪽 · 말은 없습니다
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-6">
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto rounded-full border border-[#e8d4b8]/35 bg-[#2a2018]/75 px-6 py-3 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d4b8]"
        >
          우주로 나가기
        </button>
      </div>
    </div>
  );
}
