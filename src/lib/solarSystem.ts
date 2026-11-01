import * as THREE from "three";

/**
 * Lounge-scale solar system.
 * Earth stays near the lounge; Sun opposite but close enough to read.
 * Mercury–Neptune (except Earth) sit BETWEEN Sun and Earth, alternating
 * above / below the corridor so nothing hides behind Earth.
 */

export const EARTH_POS = new THREE.Vector3(2, -9, -16);

/** Earth billboard diameter — shared scale reference. */
export const EARTH_SIZE = 18;
/**
 * Sun diameter ≈ 9× Earth. Closer sun needs a slightly smaller disk
 * so the lounge is not swallowed by the limb.
 */
export const SUN_DIAMETER = EARTH_SIZE * 9;
export const SUN_RADIUS = SUN_DIAMETER * 0.5;

/**
 * Distance from origin along the anti-Earth axis.
 * Must exceed SUN_RADIUS so the lounge (near Earth) stays outside the sphere.
 * Was 420 — pulled in so the whole corridor reads from the lounge.
 */
export const SUN_DISTANCE = 236;

/**
 * Deep-space side opposite Earth. Keep in sync with planetFlags.
 */
export const SUN_POS = EARTH_POS.clone()
  .multiplyScalar(-1)
  .normalize()
  .multiplyScalar(SUN_DISTANCE);

/**
 * Moon companion — clearly off Earth (not hugging the limb).
 * ~22u from Earth center; drawn smaller so Earth stays dominant.
 */
export const MOON_POS = new THREE.Vector3(-11, -1.2, -32);
/** Billboard diameter for the moon sprite */
export const MOON_SIZE = 2.05;

/**
 * Deep-space black hole — parked far off the ecliptic so it does not
 * duplicate / clutter the solar-system plane.
 */
export const BLACKHOLE_POS = new THREE.Vector3(-72, -40, 22);

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

  // Order preserved Sun→Earth. Larger |s|/|u| so bodies clear the sun
  // disk from the lounge (angular margin past the limb).
  return [
    {
      id: "mercury",
      label: "수성",
      kind: "rocky",
      tex: "dwarf",
      /** Closer to Earth; still clear of sun disk & Earth body */
      pos: at(0.84, 28, 30),
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
      pos: at(0.57, -40, -40),
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
      /** Near-Earth lounge neighbor; clear of Earth & sun */
      pos: at(0.90, 26, 24),
      size: B * 1.05,
      reach: 11,
      flagLift: B * 0.6,
    },
    {
      id: "jupiter",
      label: "목성",
      kind: "gas",
      tex: "gas",
      pos: at(0.72, -36, -32),
      size: B * 2.0,
      reach: 14,
      flagLift: B * 1.1,
    },
    {
      id: "saturn",
      label: "토성",
      kind: "gas",
      tex: "planet",
      pos: at(0.79, 32, 30),
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
      pos: at(0.86, -28, -26),
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
      pos: at(0.93, 24, 22),
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
