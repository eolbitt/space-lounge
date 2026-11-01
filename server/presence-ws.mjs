#!/usr/bin/env node
/**
 * Lightweight presence relay for Space Lounge.
 * Fan-out JSON messages between browsers + shared planet flags.
 */
import { WebSocketServer } from "ws";
import http from "http";
import {
  applyFlagWrite,
  flagsSyncPayload,
  ingestFlag,
} from "./flags-store.mjs";

const PORT = Number(process.env.WS_PORT || 43128);
const HOST = process.env.WS_HOST || "0.0.0.0";

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("space-lounge presence ws ok\n");
});

const wss = new WebSocketServer({ server });

function broadcast(raw, except = null) {
  for (const client of wss.clients) {
    if (client !== except && client.readyState === 1) {
      client.send(raw);
    }
  }
}

function send(socket, obj) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(obj));
  }
}

wss.on("connection", (socket) => {
  // Catch new joiner up on current flags
  send(socket, flagsSyncPayload());

  socket.on("message", (data, isBinary) => {
    if (isBinary) return;
    const raw = data.toString();
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg?.type === "who" || msg?.type === "hello") {
      send(socket, flagsSyncPayload());
      broadcast(raw, socket);
      return;
    }

    if (msg?.type === "flag_set") {
      const flag =
        msg.flag && typeof msg.flag === "object"
          ? ingestFlag(msg.flag)
          : applyFlagWrite({
              planetId: msg.planetId,
              text: msg.text,
              authorId: msg.authorId,
              updatedAt: msg.updatedAt,
            });
      if (!flag) return;
      const out = JSON.stringify({ type: "flag_set", flag });
      // Include writer so their timers stay aligned
      for (const client of wss.clients) {
        if (client.readyState === 1) client.send(out);
      }
      return;
    }

    if (msg?.type === "flags_sync") {
      // Client asking for refresh
      send(socket, flagsSyncPayload());
      return;
    }

    broadcast(raw, socket);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[presence-ws] listening on ws://${HOST}:${PORT}`);
});
