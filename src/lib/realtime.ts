import type { AvatarState } from "./constants";
import {
  applyFlagWrite,
  settleFlags,
  type PlanetFlag,
} from "./planetFlags";

export const ROOM_CHANNEL = "space-lounge-presence-v1";
/** Browser-side durable cache — survives empty server sync / ephemeral Render disk. */
const FLAGS_STORAGE_KEY = "space-lounge-flags-v1";

/** Max peers drawn as astronauts; full count still reported to HUD. */
export const RENDER_NEAR_PEERS = 36;

const STATE_TO_CODE: Record<AvatarState, number> = {
  idle: 0,
  move: 1,
  rest: 2,
  wave: 3,
  up: 4,
  down: 5,
};
const CODE_TO_STATE: AvatarState[] = [
  "idle",
  "move",
  "rest",
  "wave",
  "up",
  "down",
];

export type PeerPose = {
  id: string;
  position: [number, number, number];
  state: AvatarState;
  updatedAt: number;
  /** Pod lounge floor XZ — present only while inside the walkable lounge */
  lounge?: [number, number];
};

export type SyncTransport = "websocket" | "broadcast" | "offline";

/** Compact presence wire — short keys / typed codes to cut free-tier WS bandwidth. */
type CompactPresence = {
  type: "s" | "h";
  /** [id, x, y, z, stateCode, updatedAt] (+ lx, lz when in lounge) */
  p: [string, number, number, number, number, number] | [string, number, number, number, number, number, number, number];
};

type WireMsg =
  | CompactPresence
  | { type: "hello"; peer: PeerPose }
  | { type: "state"; peer: PeerPose }
  | { type: "bye"; id: string }
  | { type: "who"; id: string }
  | { type: "w"; id: string }
  | { type: "b"; id: string }
  | { type: "heart"; fromId: string; toId: string; at: number }
  | { type: "flag_set"; flag: PlanetFlag }
  | { type: "flags_sync"; flags: PlanetFlag[] };

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `peer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getOrCreateSelfId() {
  if (typeof window === "undefined") return newId();
  const key = "space-lounge-self-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = newId();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function resolveWsUrl() {
  if (typeof window === "undefined") return null;
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (fromEnv) return fromEnv;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const { hostname, host } = window.location;
  if (process.env.NODE_ENV === "development") {
    return `${proto}//${hostname || "127.0.0.1"}:43128`;
  }
  return `${proto}//${host}/ws`;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function encodePresence(
  kind: "s" | "h",
  peer: PeerPose,
): CompactPresence {
  const base: [string, number, number, number, number, number] = [
    peer.id,
    round3(peer.position[0]),
    round3(peer.position[1]),
    round3(peer.position[2]),
    STATE_TO_CODE[peer.state] ?? 0,
    peer.updatedAt,
  ];
  if (peer.lounge) {
    return {
      type: kind,
      p: [
        ...base,
        round3(peer.lounge[0]),
        round3(peer.lounge[1]),
      ] as CompactPresence["p"],
    };
  }
  return { type: kind, p: base };
}

function decodePresence(msg: CompactPresence): PeerPose | null {
  const p = msg.p;
  if (!Array.isArray(p) || p.length < 6) return null;
  const state = CODE_TO_STATE[p[4] as number] ?? "idle";
  const peer: PeerPose = {
    id: String(p[0]),
    position: [Number(p[1]), Number(p[2]), Number(p[3])],
    state,
    updatedAt: Number(p[5]) || Date.now(),
  };
  if (p.length >= 8) {
    peer.lounge = [Number(p[6]), Number(p[7])];
  }
  return peer;
}

type Listener = {
  onPeers?: (peers: Map<string, PeerPose>) => void;
  onRemoteHeart?: (payload: { fromId: string; toId: string }) => void;
  onTransport?: (t: SyncTransport) => void;
  onFlags?: (flags: Map<string, PlanetFlag>) => void;
};

/**
 * Cross-device presence: WebSocket relay + BroadcastChannel fallback.
 * Throttled compact pose updates — Render free friendly (~100 concurrent target).
 */
export class PresenceRoom {
  readonly selfId: string;
  private channel: BroadcastChannel | null = null;
  private socket: WebSocket | null = null;
  private peers = new Map<string, PeerPose>();
  private flags = new Map<string, PlanetFlag>();
  private listeners = new Set<Listener>();
  private pruneTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private lastSelf: PeerPose | null = null;
  private lastPublishAt = 0;
  private transport: SyncTransport = "offline";
  private wsUrl: string | null;

  constructor() {
    this.selfId = getOrCreateSelfId();
    this.wsUrl = resolveWsUrl();
    this.hydrateFlagsFromStorage();

    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(ROOM_CHANNEL);
      this.channel.onmessage = (ev: MessageEvent<WireMsg>) => {
        this.handle(ev.data, "broadcast");
      };
      if (this.transport === "offline") this.setTransport("broadcast");
    }

    this.pruneTimer = window.setInterval(() => this.prune(), 4000);
    this.connectWs();
    this.post({ type: "who", id: this.selfId });
  }

  get isLive() {
    return this.transport !== "offline";
  }

  get peerCount() {
    return this.peers.size;
  }

  get currentTransport() {
    return this.transport;
  }

  getFlags() {
    return new Map(this.flags);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener.onPeers?.(new Map(this.peers));
    listener.onTransport?.(this.transport);
    listener.onFlags?.(new Map(this.flags));
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Adaptive send rate: ~10Hz near/moving, ~4–5Hz idle or far from others.
   */
  publish(position: [number, number, number], state: AvatarState) {
    const now = Date.now();
    const peer: PeerPose = {
      id: this.selfId,
      position,
      state,
      updatedAt: now,
      ...(this.lastSelf?.lounge ? { lounge: this.lastSelf.lounge } : {}),
    };

    const interval = this.poseIntervalMs(position, state);
    const stateChanged = this.lastSelf?.state !== state;
    const loungeChanged =
      JSON.stringify(this.lastSelf?.lounge) !== JSON.stringify(peer.lounge);
    if (
      !stateChanged &&
      !loungeChanged &&
      now - this.lastPublishAt < interval
    ) {
      this.lastSelf = peer;
      return;
    }

    this.lastSelf = peer;
    this.lastPublishAt = now;
    this.post(encodePresence("s", peer));
  }

  /** Floor-locked pose while inside the pod lounge. */
  publishLounge(lounge: [number, number], state: AvatarState) {
    const now = Date.now();
    const base = this.lastSelf?.position ?? ([0, 0.6, 0] as [
      number,
      number,
      number,
    ]);
    const peer: PeerPose = {
      id: this.selfId,
      position: base,
      state,
      updatedAt: now,
      lounge,
    };

    const interval = state === "move" ? 110 : 220;
    const changed =
      this.lastSelf?.state !== state ||
      !this.lastSelf?.lounge ||
      Math.hypot(
        this.lastSelf.lounge[0] - lounge[0],
        this.lastSelf.lounge[1] - lounge[1],
      ) > 0.04;
    if (!changed && now - this.lastPublishAt < interval) {
      this.lastSelf = peer;
      return;
    }

    this.lastSelf = peer;
    this.lastPublishAt = now;
    this.post(encodePresence("s", peer));
  }

  clearLounge() {
    if (!this.lastSelf) return;
    const { lounge: _drop, ...rest } = this.lastSelf;
    const peer: PeerPose = { ...rest, updatedAt: Date.now() };
    this.lastSelf = peer;
    this.lastPublishAt = Date.now();
    this.post(encodePresence("s", peer));
  }

  announce(position: [number, number, number], state: AvatarState) {
    const peer: PeerPose = {
      id: this.selfId,
      position,
      state,
      updatedAt: Date.now(),
    };
    this.lastSelf = peer;
    this.lastPublishAt = Date.now();
    this.post(encodePresence("h", peer));
  }

  broadcastHeart(toId: string) {
    this.post({
      type: "heart",
      fromId: this.selfId,
      toId,
      at: Date.now(),
    });
  }

  setPlanetFlag(planetId: string, text: string) {
    const flag = applyFlagWrite(
      this.flags.get(planetId),
      planetId,
      text,
      this.selfId,
    );
    if (!flag) return null;
    this.flags.set(planetId, flag);
    this.persistFlagsToStorage();
    this.emitFlags();
    this.post({ type: "flag_set", flag });
    return flag;
  }

  leave() {
    this.post({ type: "bye", id: this.selfId });
  }

  dispose() {
    this.leave();
    if (this.pruneTimer) {
      window.clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.socket?.close();
    } catch {
      /* ignore */
    }
    this.socket = null;
    this.channel?.close();
    this.channel = null;
    singleton = null;
  }

  private poseIntervalMs(
    position: [number, number, number],
    state: AvatarState,
  ): number {
    // ~8–10Hz when moving nearby; back off when idle / far
    let ms =
      state === "move" ||
      state === "wave" ||
      state === "up" ||
      state === "down"
        ? 110
        : 220;
    let nearest = Infinity;
    for (const p of this.peers.values()) {
      const dx = p.position[0] - position[0];
      const dy = p.position[1] - position[1];
      const dz = p.position[2] - position[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < nearest) nearest = d;
    }
    if (nearest > 55) ms = Math.max(ms, 220);
    if (nearest > 110) ms = Math.max(ms, 350);
    return ms;
  }

  private setTransport(t: SyncTransport) {
    if (this.transport === t) return;
    this.transport = t;
    for (const l of this.listeners) l.onTransport?.(t);
  }

  private connectWs() {
    if (!this.wsUrl || typeof window === "undefined") return;
    try {
      const ws = new WebSocket(this.wsUrl);
      this.socket = ws;
      ws.onopen = () => {
        this.setTransport("websocket");
        this.post({ type: "who", id: this.selfId });
        if (this.lastSelf) this.post(encodePresence("h", this.lastSelf));
        // After handshake sync, re-seed server from local cache (ephemeral disk).
        window.setTimeout(() => this.republishLocalFlags(), 350);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as WireMsg;
          this.handle(msg, "websocket");
        } catch {
          /* ignore bad payloads */
        }
      };
      ws.onclose = () => {
        this.socket = null;
        this.setTransport(this.channel ? "broadcast" : "offline");
        this.scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    } catch {
      this.setTransport(this.channel ? "broadcast" : "offline");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, 2500);
  }

  private post(msg: WireMsg) {
    const raw = JSON.stringify(msg);
    try {
      this.channel?.postMessage(msg);
    } catch {
      /* ignore */
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(raw);
      } catch {
        /* ignore */
      }
    }
  }

  private handle(msg: WireMsg, _via: SyncTransport) {
    if (!msg || typeof msg !== "object") return;
    const kind = msg.type;

    if (kind === "who" || kind === "w") {
      const id = "id" in msg ? msg.id : undefined;
      if (id === this.selfId) return;
      if (this.lastSelf) this.post(encodePresence("h", this.lastSelf));
      return;
    }
    if (kind === "bye" || kind === "b") {
      const id = "id" in msg ? msg.id : undefined;
      if (!id || id === this.selfId) return;
      this.peers.delete(id);
      this.emitPeers();
      return;
    }
    if (kind === "heart") {
      if (msg.fromId === this.selfId) return;
      for (const l of this.listeners) l.onRemoteHeart?.(msg);
      return;
    }
    if (kind === "flags_sync") {
      // Upsert only — never drop planted text just because the snapshot omitted it
      // (empty server after restart used to wipe clients via full Map replace).
      let changed = false;
      for (const f of msg.flags || []) {
        if (!f?.planetId || !f.text) continue;
        const prev = this.flags.get(f.planetId);
        if (!prev || f.updatedAt >= prev.updatedAt) {
          this.flags.set(f.planetId, f);
          changed = true;
        }
      }
      if (settleFlags(this.flags) || changed) {
        this.persistFlagsToStorage();
        this.emitFlags();
      }
      return;
    }
    if (kind === "flag_set") {
      const flag = msg.flag;
      if (!flag?.planetId || !flag.text) return;
      const prev = this.flags.get(flag.planetId);
      if (
        prev &&
        prev.authorId === this.selfId &&
        prev.updatedAt >= flag.updatedAt
      ) {
        return;
      }
      if (prev && prev.updatedAt > flag.updatedAt) return;
      this.flags.set(flag.planetId, flag);
      this.persistFlagsToStorage();
      this.emitFlags();
      return;
    }
    if (kind === "s" || kind === "h") {
      const peer = decodePresence(msg);
      if (!peer || peer.id === this.selfId) return;
      this.peers.set(peer.id, { ...peer, updatedAt: Date.now() });
      this.emitPeers();
      return;
    }
    if (kind === "hello" || kind === "state") {
      const peer = msg.peer;
      if (!peer || peer.id === this.selfId) return;
      this.peers.set(peer.id, { ...peer, updatedAt: Date.now() });
      this.emitPeers();
    }
  }

  private emitPeers() {
    const snap = new Map(this.peers);
    for (const l of this.listeners) l.onPeers?.(snap);
  }

  private emitFlags() {
    const snap = new Map(this.flags);
    for (const l of this.listeners) l.onFlags?.(snap);
  }

  private hydrateFlagsFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(FLAGS_STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as PlanetFlag[];
      if (!Array.isArray(list)) return;
      for (const f of list) {
        if (!f?.planetId || !f.text) continue;
        this.flags.set(f.planetId, {
          planetId: String(f.planetId),
          text: String(f.text),
          authorId: String(f.authorId || "local"),
          updatedAt: Number(f.updatedAt) || Date.now(),
          expiresAt: Number(f.expiresAt) || Date.now(),
          stable: Boolean(f.stable),
        });
      }
      settleFlags(this.flags);
    } catch {
      /* ignore corrupt cache */
    }
  }

  private persistFlagsToStorage() {
    if (typeof window === "undefined") return;
    try {
      const list = Array.from(this.flags.values()).filter((f) => f?.text);
      window.localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* quota / private mode */
    }
  }

  /** Push local planted flags back to the relay (current value only per planet). */
  private republishLocalFlags() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    settleFlags(this.flags);
    for (const flag of this.flags.values()) {
      if (!flag?.text) continue;
      this.post({ type: "flag_set", flag });
    }
  }

  private prune() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers) {
      if (now - peer.updatedAt > 10000) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitPeers();
    if (settleFlags(this.flags, now)) {
      this.persistFlagsToStorage();
      this.emitFlags();
    }
  }
}

let singleton: PresenceRoom | null = null;

export function getPresenceRoom() {
  if (typeof window === "undefined") return null;
  if (!singleton) singleton = new PresenceRoom();
  return singleton;
}
