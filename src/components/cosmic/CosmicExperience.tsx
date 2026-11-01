"use client";

import { useCallback, useEffect, useState } from "react";
import { EntryOverlay } from "./EntryOverlay";
import { Hud } from "./Hud";
import { SpaceScene } from "./SpaceScene";
import { HeartOverlay, useHeartBursts } from "./HeartOverlay";
import { PodInterior } from "./PodInterior";
import type { LoungeAction } from "@/lib/constants";
import { loungeAudio } from "@/lib/audio";
import { getPresenceRoom, type SyncTransport } from "@/lib/realtime";

export function CosmicExperience() {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [action, setAction] = useState<LoungeAction>("drift");
  const [peerCount, setPeerCount] = useState(0);
  const [nearPod, setNearPod] = useState(false);
  const [insidePod, setInsidePod] = useState(false);
  const [transport, setTransport] = useState<SyncTransport>("offline");
  const { bursts, hearts, addHeart } = useHeartBursts();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!entered) return;
    const room = getPresenceRoom();
    if (!room) return;
    return room.subscribe({
      onRemoteHeart: () => {
        addHeart({
          x: window.innerWidth * 0.5,
          y: window.innerHeight * 0.42,
        });
        loungeAudio.playSfx("heart");
      },
      onPeers: (peers) => setPeerCount(peers.size),
      onTransport: setTransport,
    });
  }, [entered, addHeart]);

  const onEnter = useCallback(() => {
    setEntered(true);
    setAction("drift");
    void loungeAudio.unlockAndStart();
  }, []);

  const onHeart = useCallback(
    (payload: { visitorId: string; screenHint: { x: number; y: number } }) => {
      addHeart(payload.screenHint);
    },
    [addHeart],
  );

  const enterPod = useCallback(() => {
    setInsidePod(true);
    setAction("still");
  }, []);

  const exitPod = useCallback(() => {
    setInsidePod(false);
    setAction("drift");
  }, []);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#05060f]">
      {mounted ? (
        <SpaceScene
          entered={entered && !insidePod}
          action={action}
          onHeart={onHeart}
          onPeerCount={setPeerCount}
          onNearPod={setNearPod}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05060f]">
          <p className="animate-breath font-sans text-sm tracking-wide text-[#8a9aaa]">
            우주를 불러오는 중…
          </p>
        </div>
      )}

      <EntryOverlay visible={!entered} onEnter={onEnter} />

      <Hud
        visible={entered && !insidePod}
        action={action}
        onAction={setAction}
        livePeers={peerCount}
        nearPod={nearPod}
        onEnterPod={enterPod}
        transport={transport}
      />
      <HeartOverlay
        visible={entered && !insidePod}
        bursts={bursts}
        hearts={hearts}
      />

      <PodInterior visible={insidePod} onExit={exitPod} />
    </main>
  );
}
