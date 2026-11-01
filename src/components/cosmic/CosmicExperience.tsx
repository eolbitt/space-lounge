"use client";

import { useCallback, useEffect, useState } from "react";
import { EntryOverlay } from "./EntryOverlay";
import { Hud } from "./Hud";
import { SpaceScene } from "./SpaceScene";
import { HeartOverlay, useHeartBursts } from "./HeartOverlay";
import type { LoungeAction } from "@/lib/constants";
import { loungeAudio } from "@/lib/audio";

export function CosmicExperience() {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [action, setAction] = useState<LoungeAction>("drift");
  const { bursts, hearts, addHeart } = useHeartBursts();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#05060f]">
      {mounted ? (
        <SpaceScene entered={entered} action={action} onHeart={onHeart} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05060f]">
          <p className="animate-breath font-sans text-sm tracking-wide text-[#8a9aaa]">
            우주를 불러오는 중…
          </p>
        </div>
      )}

      <EntryOverlay visible={!entered} onEnter={onEnter} />

      <Hud visible={entered} action={action} onAction={setAction} />
      <HeartOverlay visible={entered} bursts={bursts} hearts={hearts} />
    </main>
  );
}
