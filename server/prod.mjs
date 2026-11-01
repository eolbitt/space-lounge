#!/usr/bin/env node
/**
 * Production entry: Next.js HTTP + same-origin WebSocket presence at /ws.
 * Render free tier → one web service, PORT from env.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";

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

wss.on("connection", (socket) => {
  socket.on("message", (data, isBinary) => {
    if (isBinary) return;
    const raw = data.toString();
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === 1) {
        client.send(raw);
      }
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `[space-lounge] http://${HOST}:${PORT}  ·  ws://${HOST}:${PORT}/ws`,
  );
});
