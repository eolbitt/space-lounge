"use client";

import type { CelestialBody } from "@/lib/celestial";
import type { MockVisitor } from "@/lib/presence";
import type { PlayerMode } from "./PlayerController";

type Props = {
  visible: boolean;
  mode: PlayerMode;
  orbitTarget: CelestialBody | null;
  nearVisitor: MockVisitor | null;
  onDrift: () => void;
  onLookEarth: () => void;
};

export function Hud({
  visible,
  mode,
  orbitTarget,
  nearVisitor,
  onDrift,
  onLookEarth,
}: Props) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg tracking-tight text-[#e8eef4]/90 sm:text-xl">
            혼자지만, 같은 우주에 있는 사람들
          </p>
          <p className="mt-1 font-sans text-xs text-[#8a9aaa]">
            {mode === "orbit" && orbitTarget
              ? `${orbitTarget.nameKo} 궤도를 도는 중`
              : mode === "lookEarth"
                ? "지구를 바라보는 중"
                : "천천히 유영하는 중"}
          </p>
        </div>
        {nearVisitor && (
          <div className="animate-fade-in max-w-[12rem] rounded-sm border border-[#c8d8e8]/20 bg-[#0a1018]/55 px-3 py-2 text-right backdrop-blur-sm">
            <p className="font-sans text-[10px] tracking-wider text-[#7a8a9a] uppercase">
              가까이 지나감
            </p>
            <p className="font-sans text-sm text-[#c8d8e8]">
              {nearVisitor.nameKo}
            </p>
          </div>
        )}
      </header>

      <footer className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xs font-sans text-xs leading-relaxed text-[#7a8a9a]">
          WASD 또는 화살표로 드리프트 · 행성을 클릭하면 궤도 · Q/E로 상승·하강
        </p>
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <ActionButton
            active={mode === "drift"}
            onClick={onDrift}
            label="유영하기"
          />
          <ActionButton
            active={mode === "lookEarth"}
            onClick={onLookEarth}
            label="지구 바라보기"
          />
        </div>
      </footer>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-4 py-2 font-sans text-xs tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9eb8c8] ${
        active
          ? "border-[#d0dce8]/55 bg-[#e8eef4]/18 text-[#eef3f7]"
          : "border-[#c8d4e0]/25 bg-[#0a1018]/45 text-[#b8c8d8] hover:border-[#c8d4e0]/50"
      }`}
    >
      {label}
    </button>
  );
}
