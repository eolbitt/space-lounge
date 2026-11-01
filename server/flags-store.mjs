/**
 * In-memory shared planet flags for the presence relay.
 * Soft TTL 60s → sticky stable until overwrite.
 */

export const FLAG_MAX_CHARS = 10;
export const FLAG_TTL_MS = 60_000;

/** @type {Map<string, import('./flags-store.mjs').PlanetFlag>} */
const flags = new Map();

/**
 * @typedef {{
 *   planetId: string,
 *   text: string,
 *   authorId: string,
 *   updatedAt: number,
 *   expiresAt: number,
 *   stable: boolean,
 * }} PlanetFlag
 */

export function clampFlagText(raw) {
  const t = Array.from(String(raw ?? "").replace(/\s+/g, " ").trim());
  return t.slice(0, FLAG_MAX_CHARS).join("");
}

export function settleFlags(now = Date.now()) {
  for (const [id, f] of flags) {
    if (!f.stable && now >= f.expiresAt && f.text) {
      flags.set(id, { ...f, stable: true });
    }
  }
}

/** @returns {PlanetFlag[]} */
export function listFlags(now = Date.now()) {
  settleFlags(now);
  return Array.from(flags.values());
}

/**
 * @param {{ planetId: string, text: string, authorId: string, updatedAt?: number }} input
 * @returns {PlanetFlag | null}
 */
export function applyFlagWrite(input) {
  const planetId = String(input?.planetId || "");
  const authorId = String(input?.authorId || "");
  const text = clampFlagText(input?.text);
  if (!planetId || !authorId || !text) return null;
  const now = Number(input?.updatedAt) || Date.now();
  /** @type {PlanetFlag} */
  const flag = {
    planetId,
    text,
    authorId,
    updatedAt: now,
    expiresAt: now + FLAG_TTL_MS,
    stable: false,
  };
  flags.set(planetId, flag);
  return flag;
}

/** Accept a remote flag snapshot (authoritative overwrite by newer updatedAt). */
export function ingestFlag(flag) {
  if (!flag || typeof flag !== "object") return null;
  const planetId = String(flag.planetId || "");
  const text = clampFlagText(flag.text);
  const authorId = String(flag.authorId || "");
  if (!planetId || !text || !authorId) return null;
  const updatedAt = Number(flag.updatedAt) || Date.now();
  const prev = flags.get(planetId);
  if (prev && prev.updatedAt > updatedAt) return prev;
  /** @type {PlanetFlag} */
  const next = {
    planetId,
    text,
    authorId,
    updatedAt,
    expiresAt: Number(flag.expiresAt) || updatedAt + FLAG_TTL_MS,
    stable: Boolean(flag.stable) && Date.now() >= (Number(flag.expiresAt) || 0),
  };
  // Fresh write always clears stable until TTL passes
  if (!flag.stable || updatedAt + FLAG_TTL_MS > Date.now()) {
    next.stable = false;
    next.expiresAt = updatedAt + FLAG_TTL_MS;
  }
  flags.set(planetId, next);
  return next;
}

export function flagsSyncPayload() {
  return { type: "flags_sync", flags: listFlags() };
}
