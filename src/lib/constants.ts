/** World-space avatar height; Earth is much larger as the lounge centerpiece. */
export const AVATAR_SIZE = 0.55;

export const MOCK_VISITOR_COUNT = 8;
export const PRESENCE_NEAR_DISTANCE = 5;

/** Soft contact radius for heart points */
export const HEART_CONTACT_DISTANCE = 1.35;
/** Per-visitor cooldown before another heart can be earned */
export const HEART_COOLDOWN_MS = 14000;

export const DRIFT_SPEED = 3.4;
export const IDLE_DRIFT = 0.55;

/** Soft world bounds — wide lounge so celestial bodies feel reachable */
export const WORLD_BOUNDS = {
  x: 28,
  yMin: -5,
  yMax: 14,
  zMin: -26,
  zMax: 18,
} as const;

export type AvatarState = "idle" | "move" | "rest" | "wave";

export const ASTRONAUT_SRC: Record<AvatarState, string> = {
  idle: "/assets/astronaut/astronaut-idle.png",
  move: "/assets/astronaut/astronaut-move.png",
  rest: "/assets/astronaut/astronaut-rest.png",
  wave: "/assets/astronaut/astronaut-wave.png",
};

export type LoungeAction = "drift" | "still" | "wave";

export const AUDIO = {
  bgm: "/assets/audio/ambient-space.ogg",
  wave: "/assets/audio/sfx-wave.ogg",
  heart: "/assets/audio/sfx-heart.ogg",
} as const;
