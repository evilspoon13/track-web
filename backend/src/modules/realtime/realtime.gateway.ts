import { WebSocket, WebSocketServer } from "ws";
import type { Server as HttpServer } from "node:http";
import * as RealtimeService from "./realtime.service";

export function createRealtimeGateway(server: HttpServer): void {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket: WebSocket, req) => {
    const path = req.url ?? "";
    let activePiId: string | undefined;
    let activeClientId: string | undefined;

    if (path === "/ws/pi") {
      console.log("[ws] Pi connected");
      socket.on("message", (data) => {
        activePiId = RealtimeService.handlePiMessage(socket, data, activePiId);
      });

      socket.on("close", () => {
        console.log("[ws] Pi disconnected");
        if (activePiId) {
          RealtimeService.disconnectPi(activePiId);
        }
      });
    }
    else if (path === "/ws/client") {
      console.log("[ws] client connected");
      socket.on("message", (data) => {
        activeClientId = RealtimeService.handleClientMessage(socket, data, activeClientId);
      });

      socket.on("close", () => {
        console.log("[ws] client disconnected");
        if (activeClientId) {
          RealtimeService.disconnectClient(activeClientId);
        }
      });
    }
    else {
      socket.close(1008, "Invalid websocket path");
    }
  });
}
