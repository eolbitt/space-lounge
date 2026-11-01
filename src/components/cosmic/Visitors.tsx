"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import {
  createMockVisitors,
  visitorPose,
  type MockVisitor,
} from "@/lib/presence";
import {
  HEART_CONTACT_DISTANCE,
  HEART_COOLDOWN_MS,
  type AvatarState,
} from "@/lib/constants";
import { loungeAudio } from "@/lib/audio";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
  onHeart?: (payload: {
    visitorId: string;
    screenHint: { x: number; y: number };
  }) => void;
};

type LiveVisitor = {
  visitor: MockVisitor;
  position: [number, number, number];
  state: AvatarState;
};

/** Anonymous co-presence — same suit, no names; soft heart on contact. */
export function Visitors({ playerRef, onHeart }: Props) {
  const visitors = useMemo(() => createMockVisitors(), []);
  const [live, setLive] = useState<LiveVisitor[]>([]);
  const throttle = useRef(0);
  const cooldowns = useRef<Map<string, number>>(new Map());
  const { camera, size } = useThree();
  const tmp = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - throttle.current < 0.05) return;
    throttle.current = t;
    const now = performance.now();
    const player = playerRef.current?.position;

    const next = visitors.map((v) => {
      const pose = visitorPose(v, t);
      return { visitor: v, ...pose };
    });
    setLive(next);

    if (!player || !onHeart) return;

    for (const v of next) {
      const dx = v.position[0] - player.x;
      const dy = v.position[1] - player.y;
      const dz = v.position[2] - player.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > HEART_CONTACT_DISTANCE) continue;

      const last = cooldowns.current.get(v.visitor.id) ?? 0;
      if (now - last < HEART_COOLDOWN_MS) continue;
      cooldowns.current.set(v.visitor.id, now);

      tmp.current.set(v.position[0], v.position[1] + 0.6, v.position[2]);
      tmp.current.project(camera);
      const sx = (tmp.current.x * 0.5 + 0.5) * size.width;
      const sy = (-tmp.current.y * 0.5 + 0.5) * size.height;
      loungeAudio.playSfx("heart");
      onHeart({ visitorId: v.visitor.id, screenHint: { x: sx, y: sy } });
    }
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
