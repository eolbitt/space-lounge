"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import {
  HEART_CONTACT_DISTANCE,
  HEART_COOLDOWN_MS,
  type AvatarState,
} from "@/lib/constants";
import { loungeAudio } from "@/lib/audio";
import { getPresenceRoom, type PeerPose } from "@/lib/realtime";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
  onHeart?: (payload: {
    visitorId: string;
    screenHint: { x: number; y: number };
  }) => void;
  onPeerCount?: (count: number) => void;
};

type LiveBody = {
  id: string;
  position: [number, number, number];
  state: AvatarState;
  facing: number;
};

/** Real WebSocket / BroadcastChannel peers only — no mock avatars. */
export function Visitors({ playerRef, onHeart, onPeerCount }: Props) {
  const [peers, setPeers] = useState<Map<string, PeerPose>>(new Map());
  const [live, setLive] = useState<LiveBody[]>([]);
  const throttle = useRef(0);
  const cooldowns = useRef<Map<string, number>>(new Map());
  const prevPos = useRef<Map<string, [number, number, number]>>(new Map());
  const facingMap = useRef<Map<string, number>>(new Map());
  const { camera, size } = useThree();
  const tmp = useRef(new THREE.Vector3());
  const camRight = useRef(new THREE.Vector3());

  useEffect(() => {
    const room = getPresenceRoom();
    if (!room) return;
    return room.subscribe({
      onPeers: (next) => {
        setPeers(new Map(next));
        onPeerCount?.(next.size);
      },
    });
  }, [onPeerCount]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - throttle.current < 0.05) return;
    throttle.current = t;
    const now = performance.now();
    const player = playerRef.current?.position;

    const bodies: LiveBody[] = [];
    camRight.current.setFromMatrixColumn(camera.matrixWorld, 0);
    camRight.current.y = 0;
    if (camRight.current.lengthSq() > 1e-6) camRight.current.normalize();

    for (const peer of peers.values()) {
      const position = peer.position;
      const prev = prevPos.current.get(peer.id);
      let face = facingMap.current.get(peer.id) ?? 1;
      if (prev) {
        const dx = position[0] - prev[0];
        const dz = position[2] - prev[2];
        const lateral = dx * camRight.current.x + dz * camRight.current.z;
        if (Math.abs(lateral) > 0.002) face = lateral > 0 ? 1 : -1;
      }
      prevPos.current.set(peer.id, position);
      facingMap.current.set(peer.id, face);
      bodies.push({
        id: peer.id,
        position,
        state: peer.state,
        facing: face,
      });
    }

    setLive(bodies);

    if (!player || !onHeart) return;
    const room = getPresenceRoom();

    for (const v of bodies) {
      const dx = v.position[0] - player.x;
      const dy = v.position[1] - player.y;
      const dz = v.position[2] - player.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > HEART_CONTACT_DISTANCE) continue;

      const last = cooldowns.current.get(v.id) ?? 0;
      if (now - last < HEART_COOLDOWN_MS) continue;
      cooldowns.current.set(v.id, now);

      tmp.current.set(v.position[0], v.position[1] + 0.6, v.position[2]);
      tmp.current.project(camera);
      const sx = (tmp.current.x * 0.5 + 0.5) * size.width;
      const sy = (-tmp.current.y * 0.5 + 0.5) * size.height;
      loungeAudio.playSfx("heart");
      onHeart({ visitorId: v.id, screenHint: { x: sx, y: sy } });
      room?.broadcastHeart(v.id);
    }
  });

  return (
    <group>
      {live.map((v) => (
        <group
          key={v.id}
          position={v.position}
          userData={{ cosmicFocus: true, kind: "peer", id: v.id }}
        >
          <Astronaut state={v.state} scale={1} facing={v.facing} />
        </group>
      ))}
    </group>
  );
}
