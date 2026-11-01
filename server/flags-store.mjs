/**
 * Shared planet flags for the presence relay.
 * 1‑min forced lock after write → then overwrite allowed. Never auto-deletes by time.
 * Disk: data/flags.json holds **one current flag per planetId only** — overwrite replaces
 * the previous text in place (no history / append log). Render Free disk may be ephemeral.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const FLAG_MAX_CHARS = 10;
export const FLAG_LOCK_MS = 60_000;
export const FLAG_TTL_MS = FLAG_LOCK_MS;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const FLAGS_PATH = path.join(DATA_DIR, "flags.json");

/** @type {Map<string, PlanetFlag>} */
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

let persistTimer = null;
let loaded = false;

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

/** Normalize a raw object into a PlanetFlag or null. Never drops text for age. */
function normalizeFlag(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object") return null;
  const planetId = String(raw.planetId || "");
  const text = clampFlagText(raw.text);
  const authorId = String(raw.authorId || "");
  if (!planetId || !text || !authorId) return null;
  const updatedAt = Number(raw.updatedAt) || now;
  const expiresAt = Number(raw.expiresAt) || updatedAt + FLAG_LOCK_MS;
  const stable = Boolean(raw.stable) || now >= expiresAt;
  return { planetId, text, authorId, updatedAt, expiresAt, stable };
}

export function loadFlagsFromDisk() {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(FLAGS_PATH)) return;
    const raw = fs.readFileSync(FLAGS_PATH, "utf8");
    const data = JSON.parse(raw);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.flags)
        ? data.flags
        : [];
    const now = Date.now();
    for (const item of list) {
      const flag = normalizeFlag(item, now);
      if (flag) flags.set(flag.planetId, flag);
    }
    settleFlags(now);
    console.log(`[flags] loaded ${flags.size} from ${FLAGS_PATH}`);
  } catch (err) {
    console.warn("[flags] load failed:", err?.message || err);
  }
}

function persistFlagsNow() {
  try {
    ensureDataDir();
    settleFlags();
    // Snapshot of current flags only (Map key = planetId → single latest text)
    const payload = {
      version: 1,
      savedAt: Date.now(),
      flags: Array.from(flags.values()),
    };
    const tmp = `${FLAGS_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, FLAGS_PATH);
  } catch (err) {
    console.warn("[flags] persist failed:", err?.message || err);
  }
}

/** Debounced disk write — coalesces bursts from WS fan-in. */
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistFlagsNow();
  }, 80);
}

export function clampFlagText(raw) {
  const t = Array.from(String(raw ?? "").replace(/\s+/g, " ").trim());
  return t.slice(0, FLAG_MAX_CHARS).join("");
}

/** Unlock elapsed locks only — never delete flag text. */
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
  loadFlagsFromDisk();
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
  // Replace in place — previous text for this planet is discarded (no history)
  flags.set(planetId, flag);
  schedulePersist();
  return flag;
}

/**
 * Accept a remote flag snapshot.
 * Rejects if existing flag is still locked and the incoming write is not the lock holder refreshing the same stamp.
 * @returns {PlanetFlag | null}
 */
export function ingestFlag(flag) {
  loadFlagsFromDisk();
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
  if (now >= next.expiresAt) {
    next.stable = true;
  }
  flags.set(planetId, next);
  schedulePersist();
  return next;
}

export function flagsSyncPayload() {
  loadFlagsFromDisk();
  return { type: "flags_sync", flags: listFlags() };
}

// Eager load when the relay boots
loadFlagsFromDisk();
