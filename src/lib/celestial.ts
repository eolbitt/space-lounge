import { PLANET_RADIUS } from "./constants";

export type CelestialBody = {
  id: string;
  nameKo: string;
  /** World-space position of the body's center */
  position: [number, number, number];
  radius: number;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  /** Soft atmosphere rim */
  atmosphere?: string;
  ring?: { inner: number; outer: number; color: string };
};

/**
 * Readable celestial bodies — each ~10× avatar height.
 * Layout is poetic, not to scale: a quiet temple of the solar system.
 */
export const CELESTIAL_BODIES: CelestialBody[] = [
  {
    id: "sun",
    nameKo: "태양",
    position: [0, 0, -42],
    radius: PLANET_RADIUS * 1.35,
    color: "#f4c15a",
    emissive: "#ff9a3c",
    emissiveIntensity: 1.4,
    atmosphere: "#ffb347",
  },
  {
    id: "mercury",
    nameKo: "수성",
    position: [-18, 4, -12],
    radius: PLANET_RADIUS * 0.72,
    color: "#9a9085",
    atmosphere: "#b8aea2",
  },
  {
    id: "venus",
    nameKo: "금성",
    position: [16, -3, -8],
    radius: PLANET_RADIUS * 0.92,
    color: "#d9b87a",
    atmosphere: "#e8c98a",
  },
  {
    id: "earth",
    nameKo: "지구",
    position: [8, 2, 14],
    radius: PLANET_RADIUS,
    color: "#3d6f9e",
    emissive: "#1a4a6e",
    emissiveIntensity: 0.15,
    atmosphere: "#7ec8e8",
  },
  {
    id: "moon",
    nameKo: "달",
    position: [12.5, 3.2, 16.5],
    radius: PLANET_RADIUS * 0.38,
    color: "#c5c0b4",
    atmosphere: "#ddd8cc",
  },
  {
    id: "mars",
    nameKo: "화성",
    position: [-14, -5, 18],
    radius: PLANET_RADIUS * 0.78,
    color: "#c45a3a",
    atmosphere: "#e07850",
  },
  {
    id: "jupiter",
    nameKo: "목성",
    position: [28, 6, -22],
    radius: PLANET_RADIUS * 1.25,
    color: "#c9a078",
    atmosphere: "#e0b890",
  },
  {
    id: "saturn",
    nameKo: "토성",
    position: [-30, 8, 8],
    radius: PLANET_RADIUS * 1.1,
    color: "#d4c396",
    atmosphere: "#e8d8a8",
    ring: { inner: 1.35, outer: 2.15, color: "#e8dcc0" },
  },
  {
    id: "uranus",
    nameKo: "천왕성",
    position: [22, -10, 28],
    radius: PLANET_RADIUS * 0.95,
    color: "#7db8b8",
    atmosphere: "#9fd0d0",
  },
  {
    id: "neptune",
    nameKo: "해왕성",
    position: [-24, 2, 32],
    radius: PLANET_RADIUS * 0.95,
    color: "#3a5f9e",
    atmosphere: "#5a80c0",
  },
];

export const EARTH = CELESTIAL_BODIES.find((b) => b.id === "earth")!;
