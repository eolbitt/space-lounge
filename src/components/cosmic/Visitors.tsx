"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import {
  createMockVisitors,
  visitorPose,
  type MockVisitor,
} from "@/lib/presence";
import type { AvatarState } from "@/lib/constants";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
};

type LiveVisitor = {
  visitor: MockVisitor;
  position: [number, number, number];
  state: AvatarState;
};

/** Anonymous co-presence — same suit, no names or profiles. */
export function Visitors({ playerRef }: Props) {
  const visitors = useMemo(() => createMockVisitors(), []);
  const [live, setLive] = useState<LiveVisitor[]>([]);
  const throttle = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - throttle.current < 0.08) return;
    throttle.current = t;

    const next = visitors.map((v) => {
      const pose = visitorPose(v, t);
      // Soft avoid overlapping the local player
      const player = playerRef.current?.position;
      if (player) {
        const dx = pose.position[0] - player.x;
        const dz = pose.position[2] - player.z;
        if (dx * dx + dz * dz < 0.6) {
          pose.position[0] += 0.8;
        }
      }
      return { visitor: v, ...pose };
    });
    setLive(next);
  });

  return (
    <group>
      {live.map((v) => (
        <group key={v.visitor.id} position={v.position}>
          <Astronaut state={v.state} scale={0.92} />
        </group>
      ))}
    </group>
  );
}
