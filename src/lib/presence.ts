import { MOCK_VISITOR_COUNT } from "./constants";

export type MockVisitor = {
  id: string;
  nameKo: string;
  /** Soft suit tint */
  suit: string;
  /** Path center */
  center: [number, number, number];
  /** Drift ellipse radii */
  amp: [number, number, number];
  /** Phase offsets */
  phase: [number, number, number];
  /** Angular speeds */
  speed: [number, number, number];
};

const NAMES = [
  "고요한 방문자",
  "먼 궤도의 이",
  "천천히 지나는 이",
  "별 사이 손님",
  "같은 밤의 이",
  "조용한 유영자",
  "먼지 속의 이",
];

const SUITS = [
  "#dce6ef",
  "#e8dcc8",
  "#c8d4c0",
  "#d4c8d8",
  "#c8dce8",
  "#e8d0c0",
];

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic mock visitors — no backend for MVP. */
export function createMockVisitors(count = MOCK_VISITOR_COUNT): MockVisitor[] {
  return Array.from({ length: count }, (_, i) => {
    const s = (k: number) => seeded(i * 17 + k);
    return {
      id: `visitor-${i}`,
      nameKo: NAMES[i % NAMES.length],
      suit: SUITS[i % SUITS.length],
      center: [
        (s(1) - 0.5) * 48,
        (s(2) - 0.5) * 18,
        (s(3) - 0.5) * 48,
      ],
      amp: [4 + s(4) * 10, 1.5 + s(5) * 3, 4 + s(6) * 10],
      phase: [s(7) * Math.PI * 2, s(8) * Math.PI * 2, s(9) * Math.PI * 2],
      speed: [
        0.08 + s(10) * 0.12,
        0.05 + s(11) * 0.08,
        0.07 + s(12) * 0.1,
      ],
    };
  });
}

export function visitorPosition(v: MockVisitor, t: number): [number, number, number] {
  return [
    v.center[0] + Math.sin(t * v.speed[0] + v.phase[0]) * v.amp[0],
    v.center[1] + Math.sin(t * v.speed[1] + v.phase[1]) * v.amp[1],
    v.center[2] + Math.cos(t * v.speed[2] + v.phase[2]) * v.amp[2],
  ];
}
