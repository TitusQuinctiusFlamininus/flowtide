import { WebSocketServer } from "ws";

import { clearAllEvents, getRecentEvents } from "./db";

const wss = new WebSocketServer({
  port: 8080
});

const clients = new Set<any>();

wss.on("connection", (ws) => {
  clients.add(ws);

  // Hydrate newly connected clients with recent persisted events.
  ws.send(
    JSON.stringify({
      type: "snapshot",
      events: getRecentEvents(300),
    })
  );

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg?.type === "clear_db") {
        clearAllEvents();
        broadcast({ type: "cleared" });
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

export function broadcast(data: any) {
  for (const client of clients) {
    client.send(JSON.stringify(data));
  }
}