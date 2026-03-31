import { WebSocket, WebSocketServer } from "ws";
import type { Server as HttpServer } from "node:http";
import * as RealtimeService from "./realtime.service";
import { logger } from "../../common/logger";

export function createRealtimeGateway(server: HttpServer): void {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket: WebSocket, req) => {
    const path = req.url ?? "";
    let activePiId: string | undefined;
    let activeClientId: string | undefined;

    if (path === "/ws/pi") {
      logger.info("ws", "Pi connected", { path });
      socket.on("message", (data) => {
        activePiId = RealtimeService.handlePiMessage(socket, data, activePiId);
      });

      socket.on("close", () => {
        logger.info("ws", "Pi disconnected", { piId: activePiId ?? "unregistered" });
        if (activePiId) {
          RealtimeService.disconnectPi(activePiId);
        }
      });
    }
    else if (path === "/ws/client") {
      logger.info("ws", "Client connected", { path });
      socket.on("message", (data) => {
        activeClientId = RealtimeService.handleClientMessage(socket, data, activeClientId);
      });

      socket.on("close", () => {
        logger.info("ws", "Client disconnected", { clientId: activeClientId ?? "unregistered" });
        if (activeClientId) {
          RealtimeService.disconnectClient(activeClientId);
        }
      });
    }
    else {
      logger.warn("ws", "Connection rejected: invalid path", { path });
      socket.close(1008, "Invalid websocket path");
    }
  });
}
