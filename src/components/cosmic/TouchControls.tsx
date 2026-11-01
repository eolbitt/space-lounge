"use client";

import { useCallback, useEffect, useRef } from "react";
import { resetTouchMove, touchMove } from "@/lib/touchMove";

type Props = {
  visible: boolean;
  /** Joystick / vertical pad implies wanting to drift */
  onMoveIntent?: () => void;
};

const DEAD = 0.12;

/**
 * Mobile WASD/QE stand-in: left virtual stick + right vertical pad.
 * Pointer events stay on this overlay so canvas orbit/pinch stay free.
 */
export function TouchControls({ visible, onMoveIntent }: Props) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const stickPtr = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const radius = useRef(48);

  const applyStick = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX - origin.current.x;
      const dy = clientY - origin.current.y;
      const r = radius.current;
      const len = Math.hypot(dx, dy);
      const clamped = len > r ? r / len : 1;
      const nx = (dx * clamped) / r;
      const ny = (dy * clamped) / r;
      // Screen: +x right → strafe right (D); +y down → backward (S)
      touchMove.x = Math.abs(nx) < DEAD ? 0 : nx;
      touchMove.y = Math.abs(ny) < DEAD ? 0 : -ny;
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${nx * r}px, ${ny * r}px)`;
      }
      if (touchMove.x !== 0 || touchMove.y !== 0) onMoveIntent?.();
    },
    [onMoveIntent],
  );

  const endStick = useCallback((pointerId?: number) => {
    if (pointerId != null && stickPtr.current !== pointerId) return;
    stickPtr.current = null;
    touchMove.x = 0;
    touchMove.y = 0;
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(0px, 0px)";
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      resetTouchMove();
      endStick();
    }
    return () => {
      resetTouchMove();
    };
  }, [visible, endStick]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 block md:hidden"
      aria-hidden={false}
    >
      {/* Left: virtual stick (WASD) */}
      <div
        ref={stickRef}
        data-testid="touch-stick"
        className="pointer-events-auto absolute bottom-28 left-4 touch-none select-none"
        style={{ width: 112, height: 112 }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const el = stickRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          radius.current = Math.min(rect.width, rect.height) * 0.42;
          origin.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          stickPtr.current = e.pointerId;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          onMoveIntent?.();
          applyStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (stickPtr.current !== e.pointerId) return;
          e.preventDefault();
          e.stopPropagation();
          applyStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          endStick(e.pointerId);
        }}
        onPointerCancel={(e) => endStick(e.pointerId)}
      >
        <div className="absolute inset-0 rounded-full border border-white/25 bg-[#0a1018]/45 shadow-[inset_0_0_24px_rgba(0,0,0,0.35)] backdrop-blur-sm" />
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-[#e8eef4]/28 shadow-[0_0_16px_rgba(180,210,240,0.25)] will-change-transform"
          style={{ transform: "translate(0px, 0px)" }}
        />
        <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[10px] tracking-wide text-[#8a9aaa]">
          이동
        </span>
      </div>

      {/* Right: vertical pad (Q/E) */}
      <div
        data-testid="touch-vertical"
        className="pointer-events-auto absolute bottom-28 right-4 flex touch-none select-none flex-col gap-2"
      >
        <VertButton
          label="상승"
          testId="touch-ascend"
          onHold={(held) => {
            touchMove.up = held;
            if (held) {
              touchMove.down = false;
              onMoveIntent?.();
            }
          }}
        >
          ↑
        </VertButton>
        <VertButton
          label="하강"
          testId="touch-descend"
          onHold={(held) => {
            touchMove.down = held;
            if (held) {
              touchMove.up = false;
              onMoveIntent?.();
            }
          }}
        >
          ↓
        </VertButton>
      </div>
    </div>
  );
}

function VertButton({
  children,
  label,
  onHold,
  testId,
}: {
  children: React.ReactNode;
  label: string;
  onHold: (held: boolean) => void;
  testId?: string;
}) {
  const ptr = useRef<number | null>(null);
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-[#0a1018]/55 font-sans text-lg text-[#e8eef4] backdrop-blur-sm active:border-white/50 active:bg-[#e8eef4]/18"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ptr.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        onHold(true);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (ptr.current === e.pointerId) {
          ptr.current = null;
          onHold(false);
        }
      }}
      onPointerCancel={() => {
        ptr.current = null;
        onHold(false);
      }}
    >
      {children}
    </button>
  );
}
