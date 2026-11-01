/**
 * In-memory shared planet flags for the presence relay.
 * 1‑min forced lock after write → then overwrite allowed. Never auto-deletes.
 */

export const FLAG_MAX_CHARS = 10;
export const FLAG_LOCK_MS = 60_000;
export const FLAG_TTL_MS = FLAG_LOCK_MS;

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

function isLocked(flag, now = Date.now()) {
  if (!flag?.text) return false;
  if (flag.stable) return false;
  return now < flag.expiresAt;
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
  settleFlags(now);
  const prev = flags.get(planetId);
  if (isLocked(prev, now)) return null;
  /** @type {PlanetFlag} */
  const flag = {
    planetId,
    text,
    authorId,
    updatedAt: now,
    expiresAt: now + FLAG_LOCK_MS,
    stable: false,
  };
  flags.set(planetId, flag);
  return flag;
}

/**
 * Accept a remote flag snapshot.
 * Rejects if existing flag is still locked and the incoming write is not the lock holder refreshing the same stamp.
 * @returns {PlanetFlag | null}
 */
export function ingestFlag(flag) {
  if (!flag || typeof flag !== "object") return null;
  const planetId = String(flag.planetId || "");
  const text = clampFlagText(flag.text);
  const authorId = String(flag.authorId || "");
  if (!planetId || !text || !authorId) return null;
  const updatedAt = Number(flag.updatedAt) || Date.now();
  const now = Date.now();
  settleFlags(now);
  const prev = flags.get(planetId);

  if (prev) {
    if (prev.updatedAt > updatedAt) return prev;
    // Locked: only accept identical/newer stamp from same author writing the same lock window
    if (isLocked(prev, now) && prev.updatedAt !== updatedAt) {
      return null;
    }
  }

  /** @type {PlanetFlag} */
  const next = {
    planetId,
    text,
    authorId,
    updatedAt,
    expiresAt: updatedAt + FLAG_LOCK_MS,
    stable: false,
  };
  // If remote already past lock, mark stable
  if (now >= next.expiresAt) {
    next.stable = true;
  }
  flags.set(planetId, next);
  return next;
}

export function flagsSyncPayload() {
  return { type: "flags_sync", flags: listFlags() };
}
