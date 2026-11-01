import * as THREE from "three";
import {
  EARTH_POS,
  getSolarPlanets,
  MOON_POS,
  SUN_POS,
  SUN_RADIUS,
} from "@/lib/solarSystem";

/** Shared planet flag — max 10 chars; 1‑min forced lock then overwrite allowed. */
export const FLAG_MAX_CHARS = 10;
/** Lock duration after a write — overwrite blocked until this elapses (not a delete TTL). */
export const FLAG_LOCK_MS = 60_000;
/** @deprecated use FLAG_LOCK_MS */
export const FLAG_TTL_MS = FLAG_LOCK_MS;

export type PlanetFlag = {
  planetId: string;
  text: string;
  authorId: string;
  updatedAt: number;
  /** Lock ends at this time. Flag text stays; overwrite only after. */
  expiresAt: number;
  /** True once the lock window has passed (open for overwrite). */
  stable: boolean;
};

export type PlanetSite = {
  id: string;
  label: string;
  /** Where the 3D flag pole is drawn */
  pos: [number, number, number];
  /** Optional nearer point used for proximity / editor (defaults to pos) */
  interactPos?: [number, number, number];
  /**
   * Extra approach anchors (sun): any of these within `reach` opens the editor.
   * Distant flag tip stays visual-only; planting uses lounge / sun-face zones.
   */
  approachPos?: [number, number, number][];
  /** Distance to open the flag editor (from interactPos ?? pos) */
  reach: number;
  /** Flag tip height above planet center */
  flagLift: number;
};

/**
 * Must stay in sync with solarSystem SUN_POS / SUN_DISTANCE.
 */
export const SUN_FLAG_POS: [number, number, number] = [
  SUN_POS.x,
  SUN_POS.y,
  SUN_POS.z,
];

/** Lounge-side plant beacon — near spawn, toward the sun corridor */
function sunLoungeInteract(): [number, number, number] {
  const toSun = SUN_POS.clone().sub(EARTH_POS).normalize();
  const side = new THREE.Vector3()
    .crossVectors(toSun, new THREE.Vector3(0, 1, 0))
    .normalize();
  const up = new THREE.Vector3().crossVectors(side, toSun).normalize();
  const p = EARTH_POS.clone()
    .add(toSun.multiplyScalar(22))
    .add(up.multiplyScalar(9));
  return [p.x, p.y, p.z];
}

/** Just outside the sun disk, facing the lounge (within WORLD_BOUNDS) */
function sunFaceApproach(): [number, number, number] {
  const toEarth = EARTH_POS.clone().sub(SUN_POS).normalize();
  const p = SUN_POS.clone().add(toEarth.multiplyScalar(SUN_RADIUS + 28));
  return [p.x, p.y, p.z];
}

export const SUN_INTERACT_POS: [number, number, number] = sunLoungeInteract();
export const SUN_APPROACH_POS: [number, number, number] = sunFaceApproach();

const solar = getSolarPlanets();

/**
 * Solar-system bodies + moon + sun that can hold a shared flag.
 * Alien / duplicate sky planets removed.
 */
export const PLANET_SITES: PlanetSite[] = [
  ...solar.map((p) => ({
    id: p.id,
    label: p.label,
    pos: [p.pos.x, p.pos.y, p.pos.z] as [number, number, number],
    reach: p.reach,
    flagLift: p.flagLift,
  })),
  {
    id: "moon",
    label: "달",
    pos: [MOON_POS.x, MOON_POS.y, MOON_POS.z],
    reach: 10,
    flagLift: 2.4,
  },
  {
    id: "sun",
    label: "태양",
    pos: SUN_FLAG_POS,
    interactPos: SUN_INTERACT_POS,
    approachPos: [SUN_APPROACH_POS],
    /** Generous so the plant panel opens reliably at beacon or sun face */
    reach: 36,
    /** Tip just above sun surface */
    flagLift: SUN_RADIUS + 18,
  },
];

export function clampFlagText(raw: string) {
  const t = Array.from(raw.replace(/\s+/g, " ").trim());
  return t.slice(0, FLAG_MAX_CHARS).join("");
}

/** Flags never auto-delete — only lock/unlock. */
export function isFlagVisible(flag: PlanetFlag | undefined) {
  return Boolean(flag?.text);
}

export function isFlagLocked(flag: PlanetFlag | undefined, now = Date.now()) {
  if (!flag?.text) return false;
  if (flag.stable) return false;
  return now < flag.expiresAt;
}

export function canWriteFlag(
  prev: PlanetFlag | undefined,
  now = Date.now(),
): boolean {
  if (!prev?.text) return true;
  return !isFlagLocked(prev, now);
}

/**
 * Write/overwrite. Returns null while the previous flag is still locked.
 * A successful write starts a new 1‑minute lock.
 */
export function applyFlagWrite(
  prev: PlanetFlag | undefined,
  planetId: string,
  text: string,
  authorId: string,
  now = Date.now(),
): PlanetFlag | null {
  if (!canWriteFlag(prev, now)) return null;
  const clean = clampFlagText(text);
  if (!clean) return null;
  return {
    planetId,
    text: clean,
    authorId,
    updatedAt: now,
    expiresAt: now + FLAG_LOCK_MS,
    stable: false,
  };
}

/** Promote flags past their lock window into overwrite-open state. */
export function settleFlags(
  flags: Map<string, PlanetFlag>,
  now = Date.now(),
): boolean {
  let changed = false;
  for (const [id, f] of flags) {
    if (!f.stable && now >= f.expiresAt && f.text) {
      flags.set(id, { ...f, stable: true });
      changed = true;
    }
  }
  return changed;
}

function siteAnchors(site: PlanetSite): THREE.Vector3[] {
  const primary = site.interactPos ?? site.pos;
  const list = [new THREE.Vector3(primary[0], primary[1], primary[2])];
  for (const a of site.approachPos ?? []) {
    list.push(new THREE.Vector3(a[0], a[1], a[2]));
  }
  return list;
}

function siteDistance(pos: THREE.Vector3, site: PlanetSite) {
  let best = Infinity;
  for (const a of siteAnchors(site)) {
    best = Math.min(best, pos.distanceTo(a));
  }
  return best;
}

export function nearestPlanetSite(
  pos: THREE.Vector3,
): { site: PlanetSite; dist: number } | null {
  let best: { site: PlanetSite; dist: number } | null = null;
  for (const site of PLANET_SITES) {
    const d = siteDistance(pos, site);
    if (d <= site.reach && (!best || d < best.dist)) {
      best = { site, dist: d };
    }
  }
  return best;
}

export function getPlanetSite(id: string): PlanetSite | undefined {
  return PLANET_SITES.find((s) => s.id === id);
}
