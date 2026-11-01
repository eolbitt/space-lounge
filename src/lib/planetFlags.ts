import * as THREE from "three";

/** Shared planet flag — max 10 chars, overwrite by anyone, 1‑min soft timer. */
export const FLAG_MAX_CHARS = 10;
export const FLAG_TTL_MS = 60_000;

export type PlanetFlag = {
  planetId: string;
  text: string;
  authorId: string;
  updatedAt: number;
  /** Soft timer: rewrite/overwrite resets this. After TTL without change, flag stays (stable). */
  expiresAt: number;
  /** Once the first minute passes without overwrite, keep indefinitely until overwrite. */
  stable: boolean;
};

export type PlanetSite = {
  id: string;
  label: string;
  pos: [number, number, number];
  /** Distance to open the flag editor */
  reach: number;
  /** Flag tip height above planet center */
  flagLift: number;
};

/**
 * Major bodies that can hold a shared flag.
 * Positions match lounge mid-ground + a few mid-far aliens (reachable-ish).
 */
export const PLANET_SITES: PlanetSite[] = [
  {
    id: "earth",
    label: "지구",
    pos: [2, -9, -16],
    reach: 16,
    flagLift: 11,
  },
  {
    id: "moon",
    label: "달",
    pos: [24, 6, -30],
    reach: 10,
    flagLift: 4.2,
  },
  {
    id: "ring",
    label: "고리행성",
    pos: [-26, 8, -34],
    reach: 11,
    flagLift: 5.5,
  },
  {
    id: "blackhole",
    label: "블랙홀",
    pos: [-32, -8, -42],
    reach: 12,
    flagLift: 5,
  },
  {
    id: "alien-ice",
    label: "얼음행성",
    pos: [18, 10, -48],
    reach: 12,
    flagLift: 8,
  },
  {
    id: "alien-gas",
    label: "가스행성",
    pos: [-22, 6, -52],
    reach: 13,
    flagLift: 9,
  },
  {
    id: "alien-red",
    label: "붉은행성",
    pos: [30, -2, -40],
    reach: 10,
    flagLift: 5,
  },
];

export function clampFlagText(raw: string) {
  const t = Array.from(raw.replace(/\s+/g, " ").trim());
  return t.slice(0, FLAG_MAX_CHARS).join("");
}

export function isFlagVisible(flag: PlanetFlag | undefined, now = Date.now()) {
  if (!flag || !flag.text) return false;
  if (flag.stable) return true;
  return now < flag.expiresAt;
}

export function applyFlagWrite(
  _prev: PlanetFlag | undefined,
  planetId: string,
  text: string,
  authorId: string,
  now = Date.now(),
): PlanetFlag {
  const clean = clampFlagText(text);
  return {
    planetId,
    text: clean,
    authorId,
    updatedAt: now,
    expiresAt: now + FLAG_TTL_MS,
    stable: false,
  };
}

/** Promote flags past their first minute into sticky stable state. */
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

export function nearestPlanetSite(
  pos: THREE.Vector3,
): { site: PlanetSite; dist: number } | null {
  let best: { site: PlanetSite; dist: number } | null = null;
  for (const site of PLANET_SITES) {
    const d = pos.distanceTo(
      new THREE.Vector3(site.pos[0], site.pos[1], site.pos[2]),
    );
    if (d <= site.reach && (!best || d < best.dist)) {
      best = { site, dist: d };
    }
  }
  return best;
}
