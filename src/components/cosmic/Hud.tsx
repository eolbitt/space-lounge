"use client";

import { useEffect, useState } from "react";
import type { LoungeAction } from "@/lib/constants";
import { mockOnlineCount } from "@/lib/presence";
import { loungeAudio } from "@/lib/audio";
import type { SyncTransport } from "@/lib/realtime";

type Props = {
  visible: boolean;
  action: LoungeAction;
  onAction: (action: LoungeAction) => void;
  livePeers?: number;
  nearPod?: boolean;
  onEnterPod?: () => void;
  transport?: SyncTransport;
};

const ACTIONS: { id: LoungeAction; label: string; icon: string }[] = [
  { id: "drift", label: "떠다니기", icon: "M4 13l4-4 3 3 5-6 4 4" },
  { id: "still", label: "가만히 있기", icon: "M8 12h8M12 8v8" },
  {
    id: "wave",
    label: "인사하기",
    icon: "M8 14c2-4 6-4 8 0M10 10v4M14 9v5",
  },
];

export function Hud({
  visible,
  action,
  onAction,
  livePeers = 0,
  nearPod = false,
  onEnterPod,
  transport = "offline",
}: Props) {
  const [online, setOnline] = useState(213);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setMusicOn(loungeAudio.musicOn);
    setSfxOn(loungeAudio.sfxOn);
    const id = window.setInterval(() => setOnline(mockOnlineCount()), 5000);
    setOnline(mockOnlineCount());
    return () => window.clearInterval(id);
  }, [visible]);

  const together = online + livePeers;

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 rounded-full border border-[#d8e4f0]/70 bg-[#1a3a6d]/80 shadow-[0_0_10px_rgba(120,170,220,0.35)]"
            />
            <p className="font-display text-lg tracking-tight text-[#f2f5f8] sm:text-xl">
              Space Lounge
            </p>
          </div>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-[#0a1018]/55 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dffb0]" />
            <p className="font-sans text-xs text-[#d5dde8] sm:text-sm">
              지금 <span className="text-[#f4f7fb]">{together}명</span>이 같은 우주에
              있어요
              {livePeers > 0 && (
                <span className="ml-1 text-[#9eb0c4]">
                  · 함께 {livePeers + 1}
                </span>
              )}
              <span className="ml-1 text-[#7a8a9a]">
                ·{" "}
                {transport === "websocket"
                  ? "실시간"
                  : transport === "broadcast"
                    ? "같은 기기"
                    : "오프라인"}
              </span>
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <ToggleIcon
            label={musicOn ? "음악 끄기" : "음악 켜기"}
            pressed={musicOn}
            onClick={() => {
              const next = !musicOn;
              setMusicOn(next);
              loungeAudio.setMusicOn(next);
            }}
          >
            <path
              d="M9 18V6l10-2v12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="16" r="2" />
            {!musicOn && (
              <path d="M4 4l16 16" strokeLinecap="round" />
            )}
          </ToggleIcon>
          <ToggleIcon
            label={sfxOn ? "효과음 끄기" : "효과음 켜기"}
            pressed={sfxOn}
            onClick={() => {
              const next = !sfxOn;
              setSfxOn(next);
              loungeAudio.setSfxOn(next);
            }}
          >
            {sfxOn ? (
              <path
                d="M4 10v4M8 8v8M12 6v12M16 9v6M20 11v2"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path d="M4 10v4M8 8v8M12 6v12" strokeLinecap="round" />
                <path d="M16 9l5 6M21 9l-5 6" strokeLinecap="round" />
              </>
            )}
          </ToggleIcon>
        </div>
      </header>

      <div className="flex flex-col items-center gap-3">
        {nearPod && onEnterPod && (
          <button
            type="button"
            onClick={onEnterPod}
            className="pointer-events-auto animate-fade-in rounded-full border border-[#e8d4b8]/40 bg-[#2a2018]/65 px-5 py-2.5 font-sans text-sm tracking-wide text-[#f3e6d4] backdrop-blur-sm transition hover:border-[#f3e6d4]/6"
          >
            포드 들어가기
          </button>
        )}
        <nav className="pointer-events-auto flex flex-wrap items-end justify-center gap-2 sm:gap-3">
          {ACTIONS.map((item) => {
            const active = action === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onAction(item.id)}
                className={`flex min-w-[4.6rem] flex-col items-center gap-1 rounded-full border px-3 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9eb8c8] sm:min-w-[5.2rem] ${
                  active
                    ? "border-white/45 bg-[#e8eef4]/16 text-[#f4f7fb]"
                    : "border-white/18 bg-[#0a1018]/55 text-[#c8d4e0] hover:border-white/35"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden
                >
                  <path
                    d={item.icon}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-sans text-[11px] tracking-wide">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-xs font-sans text-[10px] leading-relaxed text-[#7a8a9a]">
            드래그로 시야 · WASD/화살표 이동 · Q/E 상승·하강
          </p>
          <div className="self-end rounded-md border border-white/12 bg-[#0a1018]/5 px-3 py-2 backdrop-blur-sm">
            <p className="font-sans text-[10px] tracking-wider text-[#8a9aaa] uppercase">
              오늘의 우주
            </p>
            <p className="font-sans text-xs text-[#d5dde8]">
              지구 위로 오로라가 지나가요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleIcon({
  children,
  label,
  pressed,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9eb8c8] ${
        pressed
          ? "border-white/30 bg-[#e8eef4]/12 text-[#e8eef4]"
          : "border-white/15 bg-[#0a1018]/4 text-[#8a9aaa]"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {children}
      </svg>
    </button>
  );
}
