"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import {
  createMockVisitors,
  visitorPosition,
  type MockVisitor,
} from "@/lib/presence";
import { PRESENCE_NEAR_DISTANCE } from "@/lib/constants";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
  onNearChange?: (near: MockVisitor | null) => void;
};

export function Visitors({ playerRef, onNearChange }: Props) {
  const visitors = useMemo(() => createMockVisitors(), []);
  const positions = useRef<Map<string, THREE.Vector3>>(new Map());
  const [nearId, setNearId] = useState<string | null>(null);
  const lastNear = useRef<string | null>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const player = playerRef.current?.position;
    if (!player) return;

    let closest: { v: MockVisitor; d: number } | null = null;

    for (const v of visitors) {
      const p = visitorPosition(v, t);
      const vec = positions.current.get(v.id) ?? new THREE.Vector3();
      vec.set(p[0], p[1], p[2]);
      positions.current.set(v.id, vec);

      const d = vec.distanceTo(player);
      if (d < PRESENCE_NEAR_DISTANCE && (!closest || d < closest.d)) {
        closest = { v, d };
      }
    }

    const nextId = closest?.v.id ?? null;
    if (nextId !== lastNear.current) {
      lastNear.current = nextId;
      setNearId(nextId);
      onNearChange?.(closest?.v ?? null);
    }
  });

  return (
    <group>
      {visitors.map((v) => (
        <VisitorAstronaut
          key={v.id}
          visitor={v}
          highlighted={nearId === v.id}
          positions={positions}
        />
      ))}
    </group>
  );
}

function VisitorAstronaut({
  visitor,
  highlighted,
  positions,
}: {
  visitor: MockVisitor;
  highlighted: boolean;
  positions: React.RefObject<Map<string, THREE.Vector3>>;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = visitorPosition(visitor, clock.elapsedTime);
    ref.current.position.set(p[0], p[1], p[2]);
    positions.current?.set(visitor.id, ref.current.position.clone());
  });

  return (
    <group ref={ref}>
      <Astronaut suit={visitor.suit} accent="#5a7088" bob={0.05} />
      {highlighted && (
        <pointLight intensity={0.4} distance={5} color="#a8c8d8" />
      )}
    </group>
  );
}
