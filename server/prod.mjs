#!/usr/bin/env node
/**
 * Production entry: Next.js HTTP + same-origin WebSocket presence at /ws.
 * Render free tier → one web service, PORT from env.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import {
  applyFlagWrite,
  flagsSyncPayload,
  ingestFlag,
} from "./flags-store.mjs";

const PORT = Number(process.env.PORT || 43127);
const HOST = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname: HOST, port: PORT });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  handle(req, res, parsedUrl);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname } = parse(req.url || "/");
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
    return;
  }
  socket.destroy();
});

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
      for (const client of wss.clients) {
        if (client.readyState === 1) client.send(out);
      }
      return;
    }

    if (msg?.type === "flags_sync") {
      send(socket, flagsSyncPayload());
      return;
    }

    broadcast(raw, socket);
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `[space-lounge] http://${HOST}:${PORT}  ·  ws://${HOST}:${PORT}/ws`,
  );
});
