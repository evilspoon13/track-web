import { WebSocket, WebSocketServer } from "ws";
import type { Server as HttpServer } from "node:http";
import * as RealtimeService from "./realtime.service";

export function createRealtimeGateway(server: HttpServer): void {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket: WebSocket, req) => {
    const path = req.url ?? "";
    const id = Date.now().toString();

    if (path === "/ws/pi") {
      console.log("[ws] Pi connected");
      RealtimeService.registerPi(id, socket);

      socket.on("message", (data) => {
        RealtimeService.handlePiMessage(id, data);
      });

      socket.on("close", () => {
        console.log("[ws] Pi disconnected");
        RealtimeService.disconnectPi(id);
      });
    }
    else if (path === "/ws/client") {
      console.log("[ws] client connected");
      RealtimeService.registerClient(id, socket);

      socket.on("message", (data) => {
        RealtimeService.handleClientMessage(id, data);
      });

      socket.on("close", () => {
        console.log("[ws] client disconnected");
        RealtimeService.disconnectClient(id);
      });
    }
    else {
      socket.close(1008, "Invalid websocket path");
    }
  });
}
