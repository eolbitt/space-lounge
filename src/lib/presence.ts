import { MOCK_VISITOR_COUNT, type AvatarState } from "./constants";

export type MockVisitor = {
  id: string;
  /** Soft path center — no personal identity */
  center: [number, number, number];
  amp: [number, number, number];
  phase: [number, number, number];
  speed: [number, number, number];
  /** Prefer rest near asteroids when close */
  likesRest: boolean;
};

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function createMockVisitors(count = MOCK_VISITOR_COUNT): MockVisitor[] {
  return Array.from({ length: count }, (_, i) => {
    const s = (k: number) => seeded(i * 19 + k);
    return {
      id: `visitor-${i}`,
      center: [
        (s(1) - 0.5) * 14,
        -0.2 + (s(2) - 0.5) * 3.5,
        -2 + (s(3) - 0.5) * 8,
      ],
      amp: [1.8 + s(4) * 2.5, 0.35 + s(5) * 0.6, 1.2 + s(6) * 2],
      phase: [s(7) * Math.PI * 2, s(8) * Math.PI * 2, s(9) * Math.PI * 2],
      speed: [
        0.12 + s(10) * 0.14,
        0.08 + s(11) * 0.1,
        0.1 + s(12) * 0.12,
      ],
      likesRest: s(13) > 0.45,
    };
  });
}

export function visitorPose(
  v: MockVisitor,
  t: number,
): { position: [number, number, number]; state: AvatarState } {
  const position: [number, number, number] = [
    v.center[0] + Math.sin(t * v.speed[0] + v.phase[0]) * v.amp[0],
    v.center[1] + Math.sin(t * v.speed[1] + v.phase[1]) * v.amp[1],
    v.center[2] + Math.cos(t * v.speed[2] + v.phase[2]) * v.amp[2],
  ];

  const cycle = (t * 0.15 + v.phase[0]) % (Math.PI * 2);
  let state: AvatarState = "idle";
  if (v.likesRest && cycle > 4.2) state = "rest";
  else if (cycle > 2.6 && cycle < 3.2) state = "wave";
  else if (cycle > 0.8 && cycle < 2.4) state = "move";

  return { position, state };
}

export function mockOnlineCount(now = Date.now()) {
  const wobble = Math.floor(Math.sin(now / 40000) * 8 + Math.cos(now / 27000) * 5);
  return 213 + wobble;
}
