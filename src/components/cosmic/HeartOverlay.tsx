"use client";

import { useCallback, useState } from "react";

export type HeartBurst = {
  id: string;
  x: number;
  y: number;
};

type Props = {
  bursts: HeartBurst[];
  hearts: number;
  visible: boolean;
};

export function HeartOverlay({ bursts, hearts, visible }: Props) {
  if (!visible) return null;

  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 sm:left-auto sm:right-4 sm:top-16 sm:translate-x-0">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f0b8c8]/25 bg-[#0a1018]/55 px-3 py-1.5 backdrop-blur-sm">
          <HeartGlyph className="h-3.5 w-3.5 text-[#f2a8b8]" />
          <p className="font-sans text-xs text-[#e8d0d8]">
            마음 <span className="text-[#f6eef0]">{hearts}</span>
          </p>
        </div>
      </div>

      {bursts.map((b) => (
        <span
          key={b.id}
          className="pointer-events-none absolute z-40 animate-heart-float text-[#f2a8b8]"
          style={{ left: b.x, top: b.y, transform: "translate(-50%, -50%)" }}
          aria-hidden
        >
          <HeartGlyph className="h-5 w-5 drop-shadow-[0_0_8px_rgba(242,168,184,0.55)]" />
        </span>
      ))}
    </>
  );
}

function HeartGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21s-6.7-4.35-9.33-7.7C.8 10.9 1.1 7.4 3.6 5.7c2-1.35 4.55-.85 6.05 1.05L12 9.2l2.35-2.45c1.5-1.9 4.05-2.4 6.05-1.05 2.5 1.7 2.8 5.2.93 7.6C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

export function useHeartBursts() {
  const [bursts, setBursts] = useState<HeartBurst[]>([]);
  const [hearts, setHearts] = useState(0);

  const addHeart = useCallback((hint: { x: number; y: number }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setHearts((h) => h + 1);
    setBursts((prev) => [...prev, { id, x: hint.x, y: hint.y }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((x) => x.id !== id));
    }, 1100);
  }, []);

  return { bursts, hearts, addHeart };
}
