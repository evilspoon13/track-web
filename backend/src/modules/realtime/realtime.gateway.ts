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
      const deviceId       = req.headers["x-device-id"] as string | undefined;
      const secret         = req.headers["x-device-secret"] as string | undefined;
      const expectedSecret = process.env.DEVICE_SECRET ?? "";
      const secretOk       = expectedSecret === "" || secret === expectedSecret;
      logger.info("ws", "Pi websocket opened", {
        path,
        deviceId: deviceId ?? null,
        hasSecretHeader: typeof secret === "string" && secret.length > 0,
        secretOk,
        deviceSecretRequired: expectedSecret !== "",
      });
      if (!deviceId || !secretOk) {
        logger.warn("ws", "Pi websocket unauthorized", {
          path,
          deviceId: deviceId ?? null,
          hasSecretHeader: typeof secret === "string" && secret.length > 0,
          secretOk,
          deviceSecretRequired: expectedSecret !== "",
        });
        socket.close(1008, "Unauthorized");
        return;
      }
      logger.info("ws", "Pi connected", { path, deviceId });
      socket.on("message", (data) => {
        activePiId = RealtimeService.handlePiMessage(socket, data, activePiId);
      });

      socket.on("close", () => {
        logger.info("ws", "Pi disconnected", { piId: activePiId ?? "unregistered" });
        if (activePiId) {
          RealtimeService.disconnectPi(activePiId, socket);
        }
      });
    }
    else if (path === "/ws/client") {
      logger.info("ws", "Client websocket opened", { path });
      logger.info("ws", "Client connected", { path });
      socket.on("message", (data) => {
        RealtimeService.handleClientMessage(socket, data, activeClientId)
          .then((nextClientId) => { activeClientId = nextClientId; })
          .catch(() => { /* ignore */ });
      });

      socket.on("close", () => {
        logger.info("ws", "Client disconnected", { clientId: activeClientId ?? "unregistered" });
        RealtimeService.disconnectClient(socket);
      });
    }
    else {
      logger.warn("ws", "Connection rejected: invalid path", { path });
      socket.close(1008, "Invalid websocket path");
    }
  });
}
