#!/usr/bin/env node
/**
 * Lightweight presence relay for Space Lounge.
 * Fan-out JSON messages between browsers. No auth, no persistence.
 */
import { WebSocketServer } from "ws";
import http from "http";

const PORT = Number(process.env.WS_PORT || 43128);
const HOST = process.env.WS_HOST || "0.0.0.0";

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("space-lounge presence ws ok\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.on("message", (data, isBinary) => {
    if (isBinary) return;
    const raw = data.toString();
    // Broadcast to everyone else
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === 1) {
        client.send(raw);
      }
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[presence-ws] listening on ws://${HOST}:${PORT}`);
});
