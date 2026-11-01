"use client";

import { useCallback, useEffect, useState } from "react";
import { EntryOverlay } from "./EntryOverlay";
import { Hud } from "./Hud";
import { SpaceScene } from "./SpaceScene";
import type { LoungeAction } from "@/lib/constants";

export function CosmicExperience() {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [action, setAction] = useState<LoungeAction>("drift");

  useEffect(() => {
    setMounted(true);
  }, []);

  const onEnter = useCallback(() => {
    setEntered(true);
    setAction("drift");
  }, []);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#05060f]">
      {mounted ? (
        <SpaceScene entered={entered} action={action} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05060f]">
          <p className="animate-breath font-sans text-sm tracking-wide text-[#8a9aaa]">
            우주를 불러오는 중…
          </p>
        </div>
      )}

      <EntryOverlay visible={!entered} onEnter={onEnter} />

      <Hud visible={entered} action={action} onAction={setAction} />
    </main>
  );
}
