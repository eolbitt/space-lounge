import * as THREE from "three";

/**
 * Lounge-scale solar system.
 * Earth stays near the lounge; Sun is opposite along −Earth.
 * Other planets sit along the Sun→Earth corridor with light lateral stagger.
 */

export const EARTH_POS = new THREE.Vector3(2, -9, -16);

/**
 * Deep-space side opposite Earth. Distance must exceed sun radius (~108)
 * so the lounge is not inside the sphere. Keep in sync with planetFlags.
 */
export const SUN_POS = EARTH_POS.clone()
  .multiplyScalar(-1)
  .normalize()
  .multiplyScalar(420);

/** Moon companion — near Earth, not one of the eight. */
export const MOON_POS = new THREE.Vector3(7, -6, -20);

/**
 * Deep-space black hole — parked far off the ecliptic so it does not
 * duplicate / clutter the solar-system plane.
 */
export const BLACKHOLE_POS = new THREE.Vector3(-95, -48, 28);

export type PlanetKind = "rocky" | "gas" | "ice";

export type SolarPlanet = {
  id: string;
  label: string;
  /** rocky / gas / ice — drives texture + tint */
  kind: PlanetKind;
  /** Texture key in LoungeObjects */
  tex: "dwarf" | "moon" | "earth" | "red" | "gas" | "planet" | "ice";
  pos: THREE.Vector3;
  size: number;
  /** Optional multiply tint */
  color?: string;
  /** Saturn-style ring sprite */
  ringed?: boolean;
  /** Flag interaction */
  reach: number;
  flagLift: number;
};

/**
 * Distances from sun along Sun→Earth (Earth ≈ 420). Compressed so outer
 * giants stay reachable in the lounge volume.
 */
function buildPlanets(): SolarPlanet[] {
  const toEarth = EARTH_POS.clone().sub(SUN_POS);
  const dist = toEarth.length();
  const forward = toEarth.normalize();
  const side = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();
  const up = new THREE.Vector3().crossVectors(side, forward).normalize();

  const at = (
    frac: number,
    s: number,
    u: number,
  ): THREE.Vector3 =>
    SUN_POS.clone()
      .add(forward.clone().multiplyScalar(dist * frac))
      .add(side.clone().multiplyScalar(s))
      .add(up.clone().multiplyScalar(u));

  // Fracs kept inside WORLD_BOUNDS while preserving
  // Sun→Mercury→…→Neptune order along the corridor.
  return [
    {
      id: "mercury",
      label: "수성",
      kind: "rocky",
      tex: "dwarf",
      // Wide lateral offset — never sit on the Earth→Sun sightline / sun disk
      pos: at(0.34, 78, 30),
      size: 3.2,
      color: "#c4b49a",
      reach: 9,
      flagLift: 2.6,
    },
    {
      id: "venus",
      label: "금성",
      kind: "rocky",
      tex: "moon",
      pos: at(0.55, -68, -20),
      size: 5.4,
      color: "#e8c878",
      reach: 10,
      flagLift: 3.8,
    },
    {
      id: "earth",
      label: "지구",
      kind: "rocky",
      tex: "earth",
      pos: EARTH_POS.clone(),
      size: 18,
      reach: 16,
      flagLift: 11,
    },
    {
      id: "mars",
      label: "화성",
      kind: "rocky",
      tex: "red",
      pos: at(1.04, 18, 3),
      size: 6.2,
      reach: 11,
      flagLift: 4.5,
    },
    {
      id: "jupiter",
      label: "목성",
      kind: "gas",
      tex: "gas",
      pos: at(1.06, -26, 4),
      size: 14,
      reach: 14,
      flagLift: 9,
    },
    {
      id: "saturn",
      label: "토성",
      kind: "gas",
      tex: "planet",
      pos: at(1.08, 28, -2),
      size: 11,
      ringed: true,
      reach: 13,
      flagLift: 7,
    },
    {
      id: "uranus",
      label: "천왕성",
      kind: "ice",
      tex: "ice",
      pos: at(1.09, -16, 10),
      size: 8,
      color: "#a8e0d8",
      reach: 12,
      flagLift: 5.5,
    },
    {
      id: "neptune",
      label: "해왕성",
      kind: "ice",
      tex: "ice",
      pos: at(1.1, 20, -6),
      size: 7.6,
      color: "#6a8cff",
      reach: 12,
      flagLift: 5.2,
    },
  ];
}

let cached: SolarPlanet[] | null = null;

export function getSolarPlanets(): SolarPlanet[] {
  if (!cached) cached = buildPlanets();
  return cached;
}
