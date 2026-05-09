import { WebSocketServer } from "ws";

import { clearAllEvents, getRecentEvents } from "./db";

let wss: WebSocketServer | null = null;

const clients = new Set<any>();

export function startWebSocketServer(host = "localhost", port = 8080) {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({ host, port });

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

  return wss;
}

export function broadcast(data: any) {
  for (const client of clients) {
    client.send(JSON.stringify(data));
  }
}