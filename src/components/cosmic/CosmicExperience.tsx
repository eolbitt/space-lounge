"use client";

import { useCallback, useEffect, useState } from "react";
import { EntryOverlay } from "./EntryOverlay";
import { Hud } from "./Hud";
import { SpaceScene } from "./SpaceScene";
import { HeartOverlay, useHeartBursts } from "./HeartOverlay";
import { PodInterior } from "./PodInterior";
import { TouchControls } from "./TouchControls";
import type { LoungeAction } from "@/lib/constants";
import { loungeAudio } from "@/lib/audio";
import { getPresenceRoom, type SyncTransport } from "@/lib/realtime";
import type { PlanetFlag, PlanetSite } from "@/lib/planetFlags";

export function CosmicExperience() {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [action, setAction] = useState<LoungeAction>("drift");
  const [peerCount, setPeerCount] = useState(0);
  const [nearPod, setNearPod] = useState(false);
  const [insidePod, setInsidePod] = useState(false);
  const [podSitting, setPodSitting] = useState(false);
  const [transport, setTransport] = useState<SyncTransport>("offline");
  const [nearPlanet, setNearPlanet] = useState<PlanetSite | null>(null);
  const [flags, setFlags] = useState<Map<string, PlanetFlag>>(() => new Map());
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
      onFlags: (next) => setFlags(new Map(next)),
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
    getPresenceRoom()?.clearLounge();
    setInsidePod(false);
    setPodSitting(false);
    setAction("drift");
  }, []);

  const onSetFlag = useCallback((planetId: string, text: string) => {
    getPresenceRoom()?.setPlanetFlag(planetId, text);
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      __enterPod?: () => void;
      __exitPod?: () => void;
    };
    w.__enterPod = enterPod;
    w.__exitPod = exitPod;
    return () => {
      delete w.__enterPod;
      delete w.__exitPod;
    };
  }, [enterPod, exitPod]);

  /** Stick/vertical pad → ensure drift mode so movement isn't blocked by Rest/Wave */
  const onTouchMoveIntent = useCallback(() => {
    setAction((prev) => (prev === "drift" ? prev : "drift"));
  }, []);

  const planetFlag = nearPlanet ? flags.get(nearPlanet.id) ?? null : null;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden overscroll-none bg-[#05060f] [-webkit-user-select:none] [user-select:none]">
      {mounted ? (
        <SpaceScene
          entered={entered && !insidePod}
          action={action}
          onHeart={onHeart}
          onPeerCount={setPeerCount}
          onNearPod={setNearPod}
          onNearPlanet={setNearPlanet}
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
        nearPlanet={nearPlanet}
        planetFlag={planetFlag}
        onSetFlag={onSetFlag}
      />
      <HeartOverlay
        visible={entered && !insidePod}
        bursts={bursts}
        hearts={hearts}
      />

      <PodInterior
        visible={insidePod}
        onExit={exitPod}
        onSittingChange={setPodSitting}
      />
      <TouchControls
        visible={entered && !podSitting}
        walkOnly={insidePod}
        onMoveIntent={insidePod ? undefined : onTouchMoveIntent}
      />
    </main>
  );
}
