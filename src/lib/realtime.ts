import type { AvatarState } from "./constants";

export const ROOM_CHANNEL = "space-lounge-presence-v1";

export type PeerPose = {
  id: string;
  position: [number, number, number];
  state: AvatarState;
  updatedAt: number;
};

type WireMsg =
  | { type: "hello"; peer: PeerPose }
  | { type: "state"; peer: PeerPose }
  | { type: "bye"; id: string }
  | { type: "who"; id: string }
  | { type: "heart"; fromId: string; toId: string; at: number };

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

type Listener = {
  onPeers?: (peers: Map<string, PeerPose>) => void;
  onRemoteHeart?: (payload: { fromId: string; toId: string }) => void;
};

/**
 * Same-origin multi-tab presence via BroadcastChannel.
 * No names/profiles — anonymous astronaut poses only.
 */
export class PresenceRoom {
  readonly selfId: string;
  private channel: BroadcastChannel | null = null;
  private peers = new Map<string, PeerPose>();
  private listeners = new Set<Listener>();
  private pruneTimer: number | null = null;
  private supported: boolean;
  private lastSelf: PeerPose | null = null;

  constructor() {
    this.selfId = getOrCreateSelfId();
    this.supported =
      typeof window !== "undefined" && typeof BroadcastChannel !== "undefined";
    if (!this.supported) return;

    this.channel = new BroadcastChannel(ROOM_CHANNEL);
    this.channel.onmessage = (ev: MessageEvent<WireMsg>) => {
      this.handle(ev.data);
    };

    this.pruneTimer = window.setInterval(() => this.prune(), 4000);
    this.post({ type: "who", id: this.selfId });
  }

  get isLive() {
    return this.supported;
  }

  get peerCount() {
    return this.peers.size;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener.onPeers?.(new Map(this.peers));
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(position: [number, number, number], state: AvatarState) {
    const peer: PeerPose = {
      id: this.selfId,
      position,
      state,
      updatedAt: Date.now(),
    };
    this.lastSelf = peer;
    this.post({ type: "state", peer });
  }

  announce(position: [number, number, number], state: AvatarState) {
    const peer: PeerPose = {
      id: this.selfId,
      position,
      state,
      updatedAt: Date.now(),
    };
    this.lastSelf = peer;
    this.post({ type: "hello", peer });
  }

  broadcastHeart(toId: string) {
    this.post({
      type: "heart",
      fromId: this.selfId,
      toId,
      at: Date.now(),
    });
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
    this.channel?.close();
    this.channel = null;
    singleton = null;
  }

  private post(msg: WireMsg) {
    try {
      this.channel?.postMessage(msg);
    } catch {
      /* ignore */
    }
  }

  private handle(msg: WireMsg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "who") {
      if (msg.id === this.selfId) return;
      if (this.lastSelf) this.post({ type: "hello", peer: this.lastSelf });
      return;
    }
    if (msg.type === "bye") {
      if (msg.id === this.selfId) return;
      this.peers.delete(msg.id);
      this.emitPeers();
      return;
    }
    if (msg.type === "heart") {
      if (msg.fromId === this.selfId) return;
      for (const l of this.listeners) l.onRemoteHeart?.(msg);
      return;
    }
    if (msg.type === "hello" || msg.type === "state") {
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

  private prune() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers) {
      if (now - peer.updatedAt > 8000) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitPeers();
  }
}

let singleton: PresenceRoom | null = null;

export function getPresenceRoom() {
  if (typeof window === "undefined") return null;
  if (!singleton) singleton = new PresenceRoom();
  return singleton;
}
