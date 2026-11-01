"use client";

import { useCallback, useEffect, useState } from "react";
import { EntryOverlay } from "./EntryOverlay";
import { Hud } from "./Hud";
import { SpaceScene } from "./SpaceScene";
import type { PlayerMode } from "./PlayerController";
import type { CelestialBody } from "@/lib/celestial";
import type { MockVisitor } from "@/lib/presence";

export function CosmicExperience() {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<PlayerMode>("drift");
  const [orbitTarget, setOrbitTarget] = useState<CelestialBody | null>(null);
  const [nearVisitor, setNearVisitor] = useState<MockVisitor | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onEnter = useCallback(() => {
    setEntered(true);
    setMode("drift");
  }, []);

  const onSelectBody = useCallback((body: CelestialBody) => {
    setOrbitTarget(body);
    setMode("orbit");
  }, []);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#05070c]">
      {mounted ? (
        <SpaceScene
          entered={entered}
          mode={mode}
          orbitTarget={orbitTarget}
          onSelectBody={onSelectBody}
          onNearVisitor={setNearVisitor}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05070c]">
          <p className="animate-breath font-sans text-sm tracking-wide text-[#8a9aaa]">
            우주를 불러오는 중…
          </p>
        </div>
      )}

      <EntryOverlay visible={!entered} onEnter={onEnter} />

      <Hud
        visible={entered}
        mode={mode}
        orbitTarget={orbitTarget}
        nearVisitor={nearVisitor}
        onDrift={() => {
          setMode("drift");
          setOrbitTarget(null);
        }}
        onLookEarth={() => {
          setMode("lookEarth");
          setOrbitTarget(null);
        }}
      />
    </main>
  );
}
