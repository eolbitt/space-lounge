import * as THREE from "three";

/**
 * Lounge-scale solar system.
 * Earth stays near the lounge; Sun opposite.
 * Mercury–Neptune (except Earth) sit BETWEEN Sun and Earth, alternating
 * above / below the corridor so nothing hides behind Earth.
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
export const MOON_POS = new THREE.Vector3(8, -5.5, -12);

/**
 * Deep-space black hole — parked far off the ecliptic so it does not
 * duplicate / clutter the solar-system plane.
 */
export const BLACKHOLE_POS = new THREE.Vector3(-95, -48, 28);

/** ~10× AVATAR_SIZE (0.55) — gas giants a bit larger. */
export const BODY_SCALE = 5.5;

export type PlanetKind = "rocky" | "gas" | "ice";

export type SolarPlanet = {
  id: string;
  label: string;
  kind: PlanetKind;
  tex: "dwarf" | "moon" | "earth" | "red" | "gas" | "planet" | "ice";
  pos: THREE.Vector3;
  size: number;
  color?: string;
  ringed?: boolean;
  reach: number;
  flagLift: number;
};

/**
 * Place bodies on Sun→Earth corridor.
 * `frac` ∈ (0,1) = between Sun and Earth (never behind Earth).
 * `u` = above(+)/below(−) the corridor; `s` = left/right stagger
 * (keeps inner worlds off the sun disk).
 */
function buildPlanets(): SolarPlanet[] {
  const toEarth = EARTH_POS.clone().sub(SUN_POS);
  const dist = toEarth.length();
  const forward = toEarth.normalize();
  const side = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();
  const up = new THREE.Vector3().crossVectors(side, forward).normalize();

  const at = (frac: number, s: number, u: number): THREE.Vector3 =>
    SUN_POS.clone()
      .add(forward.clone().multiplyScalar(dist * frac))
      .add(side.clone().multiplyScalar(s))
      .add(up.clone().multiplyScalar(u));

  const B = BODY_SCALE;

  // Even fan BETWEEN Sun and Earth (frac < 1) — alternate above / below.
  // Large |u| + |s| so worlds read above/below the corridor and clear the sun disk.
  return [
    {
      id: "mercury",
      label: "수성",
      kind: "rocky",
      tex: "dwarf",
      pos: at(0.24, 50, 72),
      size: B * 1.0,
      color: "#c4b49a",
      reach: 9,
      flagLift: B * 0.55,
    },
    {
      id: "venus",
      label: "금성",
      kind: "rocky",
      tex: "moon",
      pos: at(0.34, -55, -70),
      size: B * 1.15,
      color: "#e8c878",
      reach: 10,
      flagLift: B * 0.65,
    },
    {
      id: "earth",
      label: "지구",
      kind: "rocky",
      tex: "earth",
      pos: EARTH_POS.clone(),
      size: B * 2.2,
      reach: 16,
      flagLift: B * 1.4,
    },
    {
      id: "mars",
      label: "화성",
      kind: "rocky",
      tex: "red",
      pos: at(0.44, 38, 48),
      size: B * 1.05,
      reach: 11,
      flagLift: B * 0.6,
    },
    {
      id: "jupiter",
      label: "목성",
      kind: "gas",
      tex: "gas",
      pos: at(0.54, -44, -42),
      size: B * 2.0,
      reach: 14,
      flagLift: B * 1.1,
    },
    {
      id: "saturn",
      label: "토성",
      kind: "gas",
      tex: "planet",
      pos: at(0.64, 40, 40),
      size: B * 1.75,
      ringed: true,
      reach: 13,
      flagLift: B * 0.95,
    },
    {
      id: "uranus",
      label: "천왕성",
      kind: "ice",
      tex: "ice",
      pos: at(0.74, -36, -36),
      size: B * 1.35,
      color: "#a8e0d8",
      reach: 12,
      flagLift: B * 0.75,
    },
    {
      id: "neptune",
      label: "해왕성",
      kind: "ice",
      tex: "ice",
      pos: at(0.84, 34, 32),
      size: B * 1.3,
      color: "#6a8cff",
      reach: 12,
      flagLift: B * 0.7,
    },
  ];
}

let cached: SolarPlanet[] | null = null;

export function getSolarPlanets(): SolarPlanet[] {
  if (!cached) cached = buildPlanets();
  return cached;
}

/** Test helper — force rebuild after hot edits in the same process. */
export function resetSolarPlanetsCache() {
  cached = null;
}
