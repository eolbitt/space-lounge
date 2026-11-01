"use client";

import { useEffect, useState } from "react";
import type { LoungeAction } from "@/lib/constants";
import { mockOnlineCount } from "@/lib/presence";
import { loungeAudio } from "@/lib/audio";
import type { SyncTransport } from "@/lib/realtime";
import {
  FLAG_LOCK_MS,
  FLAG_MAX_CHARS,
  isFlagLocked,
  isFlagVisible,
  type PlanetFlag,
  type PlanetSite,
} from "@/lib/planetFlags";

type Props = {
  visible: boolean;
  action: LoungeAction;
  onAction: (action: LoungeAction) => void;
  livePeers?: number;
  nearPod?: boolean;
  onEnterPod?: () => void;
  transport?: SyncTransport;
  nearPlanet?: PlanetSite | null;
  planetFlag?: PlanetFlag | null;
  onSetFlag?: (planetId: string, text: string) => void;
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
  nearPlanet = null,
  planetFlag = null,
  onSetFlag,
}: Props) {
  const [online, setOnline] = useState(213);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [flagDraft, setFlagDraft] = useState("");
  const [flagNow, setFlagNow] = useState(() => Date.now());
  const [flagClosed, setFlagClosed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMusicOn(loungeAudio.musicOn);
    setSfxOn(loungeAudio.sfxOn);
    const id = window.setInterval(() => setOnline(mockOnlineCount()), 5000);
    setOnline(mockOnlineCount());
    return () => window.clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!nearPlanet) {
      setFlagDraft("");
      setFlagClosed(false);
      return;
    }
    setFlagClosed(false);
    setFlagDraft(planetFlag?.text ?? "");
  }, [nearPlanet?.id, planetFlag?.text, nearPlanet]);

  useEffect(() => {
    if (!nearPlanet) return;
    const id = window.setInterval(() => setFlagNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nearPlanet]);

  const together = online + livePeers;
  const flagShown = isFlagVisible(planetFlag ?? undefined);
  const locked = isFlagLocked(planetFlag ?? undefined, flagNow);
  const lockLeft = locked
    ? Math.max(0, Math.ceil((planetFlag!.expiresAt - flagNow) / 1000))
    : null;

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
        {nearPlanet && onSetFlag && !flagClosed && (
          <>
            {/* Backdrop — tap/click outside closes the editor */}
            <button
              type="button"
              aria-label="깃발 창 닫기"
              className="pointer-events-auto absolute inset-0 z-40 cursor-default bg-transparent"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFlagClosed(true);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
            />
          <form
            className="pointer-events-auto relative z-50 flex w-[min(92vw,22rem)] flex-col gap-2 rounded-xl border border-white/20 bg-[#0a121c]/88 px-3 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md animate-fade-in"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (locked) return;
              const t = flagDraft.trim();
              if (!t) return;
              onSetFlag(nearPlanet.id, t);
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-sans text-xs tracking-wide text-[#e8eef4]">
                {nearPlanet.label} 깃발
              </p>
              <p className="font-sans text-[10px] text-[#8a9aaa]">
                {locked && lockLeft != null
                  ? `${lockLeft}초 잠금`
                  : flagShown
                    ? "덮어쓰기 가능"
                    : `꽂은 뒤 ${FLAG_LOCK_MS / 1000}초 잠금`}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                value={flagDraft}
                maxLength={FLAG_MAX_CHARS}
                placeholder="최대 10자"
                disabled={locked}
                aria-label={`${nearPlanet.label} 깃발 문구`}
                onChange={(e) => {
                  const chars = Array.from(e.target.value);
                  setFlagDraft(chars.slice(0, FLAG_MAX_CHARS).join(""));
                }}
                className="min-w-0 flex-1 rounded-lg border border-white/18 bg-[#060a10]/8 px-3 py-2 font-sans text-sm text-[#f2f5f8] outline-none placeholder:text-[#6a7a8a] focus:border-[#9eb8c8]/55 disabled:opacity-55"
              />
              <button
                type="submit"
                disabled={locked}
                className="shrink-0 rounded-lg border border-[#c8d8e8]/35 bg-[#1a2838]/9 px-3 py-2 font-sans text-sm text-[#eef3f8] transition hover:border-[#e8eef4]/55 disabled:cursor-not-allowed disabled:opacity-45"
              >
                꽂기
              </button>
            </div>
            {flagShown && planetFlag?.text ? (
              <p className="font-sans text-[11px] text-[#9eb0c4]">
                지금: <span className="text-[#f2f5f8]">{planetFlag.text}</span>
                {locked ? " · 잠금 중" : ""}
              </p>
            ) : (
              <p className="font-sans text-[11px] text-[#7a8a9a]">
                비어 있어요 · 1분간 잠긴 뒤 다른 사람이 덮어쓸 수 있어요
              </p>
            )}
          </form>
          </>
        )}
        {nearPod && onEnterPod && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEnterPod();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className="pointer-events-auto relative z-50 animate-fade-in rounded-full border border-[#e8d4b8]/40 bg-[#2a2018]/85 px-5 py-2.5 font-sans text-sm tracking-wide text-[#f3e6d4] shadow-[0_0_24px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:border-[#f3e6d4]/6"
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAction(item.id);
                }}
                onPointerDown={(e) => {
                  // Keep HUD taps from reaching the canvas (orbit / double-tap focus)
                  e.stopPropagation();
                }}
                className={`flex min-w-[4.6rem] flex-col items-center justify-center gap-1 rounded-full border px-3 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9eb8c8] sm:min-w-[5.2rem] ${
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
            드래그 시야 · 핀치 줌 · 왼쪽 스틱 이동 · ↑↓ 상승·하강 · WASD/QE
            (데스크톱)
          </p>
          <div className="self-end rounded-md border border-white/12 bg-[#0a1018]/5 px-3 py-2 backdrop-blur-sm">
            <p className="font-sans text-[10px] tracking-wider text-[#8a9aaa] uppercase">
              오늘의 우주
            </p>
            <p className="font-sans text-xs text-[#d5dde8]">
              행성 깃발을 꽂아 같은 우주에 흔적을 남겨요
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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
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
