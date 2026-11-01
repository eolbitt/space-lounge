/**
 * Shared touch / virtual-stick intent for mobile (WASD/QE stand-in).
 * Written by TouchControls, read by PlayerController each frame.
 */
export type TouchMoveState = {
  /** -1..1 strafe (A/D) */
  x: number;
  /** -1..1 forward (W/S), + = forward */
  y: number;
  /** hold Q */
  up: boolean;
  /** hold E */
  down: boolean;
};

export const touchMove: TouchMoveState = {
  x: 0,
  y: 0,
  up: false,
  down: false,
};

export function resetTouchMove() {
  touchMove.x = 0;
  touchMove.y = 0;
  touchMove.up = false;
  touchMove.down = false;
}

export function touchMoveActive() {
  return (
    Math.abs(touchMove.x) > 0.08 ||
    Math.abs(touchMove.y) > 0.08 ||
    touchMove.up ||
    touchMove.down
  );
}
