import { WebSocket, WebSocketServer } from "ws";
import type { Server as HttpServer } from "node:http";
import { json } from "node:stream/consumers";

export function createRealtimeGateway(server: HttpServer): void {
  const wss = new WebSocketServer({ server });

  let clientSockets = new Map<number, WebSocket>();
  const piSockets = new Map<number, WebSocket>();
  let currentPi: WebSocket | null = null;

  wss.on("connection", (socket: WebSocket, req) => {
    const path = req.url ?? "";
    const id = Date.now()

    if (path === "/ws/pi") {
      console.log("[ws] PI connected");
      piSockets.set(id, socket);
      currentPi = socket;

      socket.on("message", (data) => {
        const message = data.toString();
        console.log("[ws][pi]", message);

        for (const socket of clientSockets.values()) {
            socket.send(JSON.stringify({type: "Telemetry", payload: "Test message:" + data}))
        }
      });

      socket.on("close", () => {
        console.log("[ws] PI disconnected");
        piSockets.delete(id);
        if (currentPi == piSockets.get(id)) {
            currentPi = null;
        }
      });
    }
    else if (path === "/ws/client") {
      console.log("[ws] client connected");

      clientSockets.set(id, socket);
      socket.send(JSON.stringify({ type: "status", payload: "connected" }));

      socket.on("message", (data) => {
        const message = data.toString();
        console.log("[ws][client]", message);

        if(currentPi) {
            currentPi.send(JSON.stringify({type: "config:update", payload: "New update incoming: " + data}));
        }
      });

      socket.on("close", () => {
        console.log("[ws] client disconnected");
        clientSockets.delete(id);
      });
    }
    else {
      socket.close(1008, "Invalid websocket path");
    }
  });
}
