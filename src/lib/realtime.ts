import type { AvatarState } from "./constants";

export const ROOM_CHANNEL = "space-lounge-presence-v1";

export type PeerPose = {
  id: string;
  position: [number, number, number];
  state: AvatarState;
  updatedAt: number;
};

export type SyncTransport = "websocket" | "broadcast" | "offline";

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

function resolveWsUrl() {
  if (typeof window === "undefined") return null;
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (fromEnv) return fromEnv;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const { hostname, host } = window.location;
  // `next dev` + separate `dev:ws` process on :43128
  if (process.env.NODE_ENV === "development") {
    return `${proto}//${hostname || "127.0.0.1"}:43128`;
  }
  // Production / `start:prod`: same-origin upgrade path
  return `${proto}//${host}/ws`;
}

type Listener = {
  onPeers?: (peers: Map<string, PeerPose>) => void;
  onRemoteHeart?: (payload: { fromId: string; toId: string }) => void;
  onTransport?: (t: SyncTransport) => void;
};

/**
 * Cross-device presence: WebSocket relay + BroadcastChannel fallback.
 * Anonymous astronaut poses only — no names/profiles.
 */
export class PresenceRoom {
  readonly selfId: string;
  private channel: BroadcastChannel | null = null;
  private socket: WebSocket | null = null;
  private peers = new Map<string, PeerPose>();
  private listeners = new Set<Listener>();
  private pruneTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private lastSelf: PeerPose | null = null;
  private transport: SyncTransport = "offline";
  private wsUrl: string | null;

  constructor() {
    this.selfId = getOrCreateSelfId();
    this.wsUrl = resolveWsUrl();

    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(ROOM_CHANNEL);
      this.channel.onmessage = (ev: MessageEvent<WireMsg>) => {
        this.handle(ev.data);
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

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener.onPeers?.(new Map(this.peers));
    listener.onTransport?.(this.transport);
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
        if (this.lastSelf) this.post({ type: "hello", peer: this.lastSelf });
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as WireMsg;
          this.handle(msg);
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
