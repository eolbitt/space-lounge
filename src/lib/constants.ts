/** World-space avatar height; Earth is much larger as the lounge centerpiece. */
export const AVATAR_SIZE = 0.55;

export const MOCK_VISITOR_COUNT = 6;
export const MOCK_ONLINE_BASE = 200;
export const PRESENCE_NEAR_DISTANCE = 5;

export type AvatarState = "idle" | "move" | "rest" | "wave";

export const ASTRONAUT_SRC: Record<AvatarState, string> = {
  idle: "/assets/astronaut/astronaut-idle.png",
  move: "/assets/astronaut/astronaut-move.png",
  rest: "/assets/astronaut/astronaut-rest.png",
  wave: "/assets/astronaut/astronaut-wave.png",
};

export type LoungeAction = "drift" | "still" | "wave" | "look";
