import { type RawData, WebSocket } from "ws";
import type { PiConnection, ClientConnection } from "./realtime.types";
import { persistLogBuffer } from "../logs/logs.service";
import { registerDeviceHeartbeat, markDeviceDisconnected } from "../devices/devices.service";
import { logger } from "../../common/logger";
import { adminAuth, db } from "../../lib/firebaseAdmin";

interface UploadSession {
  deviceId: string;
  filename: string;
  fileSize: number;
  chunks: Map<number, Buffer>;
  startedAt: number;
}

const activeSessions = new Map<string, UploadSession>();

let clientSockets = new Map<string, ClientConnection>();
const piSockets = new Map<string, PiConnection>();
const socketToPiId = new Map<WebSocket, string>();
const socketToClientId = new Map<WebSocket, string>();
const PI_DEADLINE_MS = 20_000;
const PI_MONITOR_INTERVAL_MS = 5_000;

setInterval(() => {
  const now = Date.now();
  for (const [piId, connection] of piSockets.entries()) {
    const ageMs = now - connection.lastHeartbeat;
    if (ageMs > PI_DEADLINE_MS) {
      logger.warn("ws", "Pi stale, dropping", { piId, ageMs });
      try {
        connection.socket.close(1000, "Pi heartbeat missed");
      } catch {
        // ignore close failures
      }
      disconnectPi(piId);
    }
  }
  const UPLOAD_TTL_MS = 5 * 60 * 1000;
  for (const [key, session] of activeSessions.entries()) {
    if (now - session.startedAt > UPLOAD_TTL_MS) {
      logger.warn("logs", "Dropping stale upload session", { filename: session.filename });
      activeSessions.delete(key);
    }
  }
}, PI_MONITOR_INTERVAL_MS);

function normalizePiId(parsed: { device_id?: unknown }): string | null {
  if (typeof parsed.device_id === "string" && parsed.device_id.trim().length > 0) {
    return parsed.device_id;
  }

  return null;
}

function normalizeClientId(parsed: { client_id?: unknown }): string | null {
  if (typeof parsed.client_id === "string" && parsed.client_id.trim().length > 0) {
    return parsed.client_id;
  }

  return null;
}

function registerPiById(piId: string, socket: WebSocket): PiConnection {
  const existingForSocket = socketToPiId.get(socket);
  if (existingForSocket && existingForSocket !== piId) {
    const previousConnection = piSockets.get(existingForSocket);
    if (previousConnection?.socket === socket) {
      piSockets.delete(existingForSocket);
    }
  }

  const existing = piSockets.get(piId);
  if (existing) {
    if (existing.socket !== socket) {
      const oldSocket = existing.socket;
      if (socketToPiId.get(oldSocket) === piId) {
        socketToPiId.delete(oldSocket);
      }
      try {
        oldSocket.close(1000, "Pi web socket replaced");
      } catch {
        // ignore close failures
      }
    }

    existing.connectedAt = Date.now();
    existing.lastHeartbeat = Date.now();
    existing.socket = socket;
    socketToPiId.set(socket, piId);
    piSockets.set(piId, existing);
    return existing;
  }

  const connection: PiConnection = {
    socket,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  piSockets.set(piId, connection);
  socketToPiId.set(socket, piId);
  return connection;
}

function registerClientById(clientId: string, socket: WebSocket): ClientConnection {
  const existingForSocket = socketToClientId.get(socket);
  if (existingForSocket && existingForSocket !== clientId) {
    const previousConnection = clientSockets.get(existingForSocket);
    if (previousConnection?.socket === socket) {
      clientSockets.delete(existingForSocket);
    }
  }

  const existing = clientSockets.get(clientId);
  if (existing) {
    if (existing.socket !== socket) {
      const oldSocket = existing.socket;
      if (socketToClientId.get(oldSocket) === clientId) {
        socketToClientId.delete(oldSocket);
      }
      try {
        oldSocket.close(1000, "Client web socket replaced");
      } catch {
        // ignore close failures
      }
    }

    existing.connectedAt = Date.now();
    existing.lastHeartbeat = Date.now();
    existing.socket = socket;
    socketToClientId.set(socket, clientId);
    clientSockets.set(clientId, existing);
    return existing;
  }

  const connection: ClientConnection = {
    socket,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  clientSockets.set(clientId, connection);
  socketToClientId.set(socket, clientId);
  return connection;
}

async function resolveDeviceIdForUid(uid: string, emailHint?: string): Promise<string | null> {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const existingDeviceId = userSnap.exists ? (userSnap.data()?.device_id as unknown) : undefined;
  if (typeof existingDeviceId === "string" && existingDeviceId.trim().length) {
    return existingDeviceId;
  }

  let email = typeof emailHint === "string" ? emailHint.trim().toLowerCase() : undefined;
  if (!email) {
    const userRecord = await adminAuth.getUser(uid);
    email = userRecord.email?.trim().toLowerCase();
  }
  if (!email) return null;

  const deviceSnaps = await db.collection("devices")
    .where("teamMembers", "array-contains", email)
    .get();

  let newestDeviceId: string | null = null;
  let newestUpdatedAtMs = -1;

  for (const doc of deviceSnaps.docs) {
    const data = doc.data();
    const updatedAt = data.updatedAt as { toMillis?: () => number } | undefined;
    const updatedAtMs = typeof updatedAt?.toMillis === "function" ? updatedAt.toMillis() : 0;
    if (updatedAtMs > newestUpdatedAtMs) {
      newestUpdatedAtMs = updatedAtMs;
      newestDeviceId = (typeof data.device_id === "string" && data.device_id.trim().length)
        ? (data.device_id as string)
        : doc.id;
    }
  }

  if (newestDeviceId) {
    await userRef.set({ device_id: newestDeviceId }, { merge: true });
  }

  return newestDeviceId;
}

export function disconnectPi(piId: string, socket?: WebSocket) {
  const connection = piSockets.get(piId);
  if (!connection) {
    if (socket && socketToPiId.get(socket) === piId) {
      socketToPiId.delete(socket);
    }
    return;
  }

  if (socket && connection.socket !== socket) {
    if (socketToPiId.get(socket) === piId) {
      socketToPiId.delete(socket);
    }
    return;
  }

  if (socketToPiId.get(connection.socket) === piId) {
    socketToPiId.delete(connection.socket);
  }

  piSockets.delete(piId);
  markDeviceDisconnected(piId).catch(console.error);
}

export function disconnectClient(id: string, socket?: WebSocket) {
  const connection = clientSockets.get(id);
  if (!connection) {
    if (socket && socketToClientId.get(socket) === id) {
      socketToClientId.delete(socket);
    }
    return;
  }

  if (socket && connection.socket !== socket) {
    if (socketToClientId.get(socket) === id) {
      socketToClientId.delete(socket);
    }
    return;
  }

  if (socketToClientId.get(connection.socket) === id) {
    socketToClientId.delete(connection.socket);
  }

  clientSockets.delete(id);
}

export function handlePiMessage(socket: WebSocket, data: RawData, registeredPiId?: string): string | undefined {
  const message = data.toString();
  let activePiId = registeredPiId;

  // Heartbeat path carries pi identity and should be used for registration
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as {
        type?: string;
        device_id?: unknown;
        payload?: unknown;
        filename?: unknown;
        file_size?: unknown;
        chunk_index?: unknown;
        data?: unknown;
        total_chunks?: unknown;
      };
      logger.info("ws", `Pi message: ${obj.type}`, { device_id: obj.device_id });

      if (obj.type === "heartbeat") {
        const nextPiId = normalizePiId(obj);
        if (nextPiId) {
          const connection = piSockets.get(nextPiId);
          if (!connection || connection.socket !== socket) {
            registerPiById(nextPiId, socket);
          } else {
            connection.lastHeartbeat = Date.now();
          }

          activePiId = nextPiId;
          registerDeviceHeartbeat(nextPiId).catch(console.error);
        } else if (registeredPiId) {
          const connection = piSockets.get(registeredPiId);
          if (connection && connection.socket === socket) {
            connection.lastHeartbeat = Date.now();
          }
        }
      } else if (obj.type === "telemetry") {
        if (!activePiId) {
          activePiId = normalizePiId(obj) || activePiId;
        }

        if (activePiId) {
          const connection = piSockets.get(activePiId);
          if (connection && connection.socket === socket) {
            const telemetryPayload = JSON.stringify({
              type: "Telemetry",
              device_id: activePiId,
              payload: obj.payload ?? obj,
            });

            for (const clientConnection of clientSockets.values()) {
              if (
                clientConnection.socket.readyState === WebSocket.OPEN &&
                clientConnection.deviceId === activePiId
              ) {
                clientConnection.socket.send(telemetryPayload);
              }
            }
          }
        }

        return activePiId;
      } else if (obj.type === "log_upload_start") {
        const deviceId = activePiId ?? normalizePiId(obj) ?? "";
        const filename = obj.filename as string;
        const fileSize = obj.file_size as number;
        if (!filename) return activePiId;
        activeSessions.set(filename, {
          deviceId,
          filename,
          fileSize,
          chunks: new Map(),
          startedAt: Date.now(),
        });
        logger.info("logs", "Upload start", { filename, fileSize, deviceId });
      } else if (obj.type === "log_upload_chunk") {
        const filename = obj.filename as string;
        const chunkIndex = obj.chunk_index as number;
        const data = obj.data as string;
        const session = activeSessions.get(filename);
        if (session) {
          session.chunks.set(chunkIndex, Buffer.from(data, "base64"));
        }
      } else if (obj.type === "log_upload_end") {
        const filename = obj.filename as string;
        const totalChunks = obj.total_chunks as number;
        const deviceId = activePiId ?? normalizePiId(obj) ?? "";
        const session = activeSessions.get(filename);
        if (!session) return activePiId;
        activeSessions.delete(filename);

        if (session.chunks.size !== totalChunks) {
          logger.warn("logs", "Incomplete upload", { filename, got: session.chunks.size, expected: totalChunks });
          return activePiId;
        }

        const ordered: Buffer[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const chunk = session.chunks.get(i);
          if (!chunk) {
            logger.warn("logs", "Missing chunk", { filename, chunkIndex: i });
            return activePiId;
          }
          ordered.push(chunk);
        }

        const sessionName = filename.replace(/\.bin$/, "");
        persistLogBuffer(deviceId, sessionName, Buffer.concat(ordered)).catch(console.error);
        logger.info("logs", "Upload complete", { filename, totalChunks });
      }
    }
  } catch {
    // ignore malformed non-JSON packets
  }
  return activePiId;
}

export function sendConfigToPi(deviceId: string, screenInfo: unknown): boolean {
  return sendMessageToPi(deviceId, { type: "config_update", payload: screenInfo });
}

export function sendMessageToPi(deviceId: string, message: unknown): boolean {
  const connection = piSockets.get(deviceId);
  if (!connection) return false;
  if (connection.socket.readyState !== WebSocket.OPEN) return false;

  const envelope =
    message && typeof message === "object"
      ? { device_id: deviceId, ...message }
      : { device_id: deviceId, payload: message };

  try {
    connection.socket.send(JSON.stringify(envelope));
    logger.info("ws", "Sent message to Pi", { deviceId });
    return true;
  } catch (error) {
    logger.warn("ws", "Failed to send message to Pi", { deviceId, error: String(error) });
    return false;
  }
}

export async function handleClientMessage(
  socket: WebSocket,
  data: RawData,
  registeredClientId?: string
): Promise<string | undefined> {
  const message = data.toString();
  let activeClientId = registeredClientId;

  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as { type?: unknown; token?: unknown; client_id?: unknown };

      if (obj.type === "auth" && typeof obj.token === "string") {
        try {
          const decoded = await adminAuth.verifyIdToken(obj.token);
          const uid = decoded.uid;
          const emailHint = typeof (decoded as { email?: unknown }).email === "string"
            ? (decoded as { email: string }).email
            : undefined;

          const deviceId = await resolveDeviceIdForUid(uid, emailHint);
          const connection = registerClientById(uid, socket);
          connection.uid = uid;
          if (deviceId) {
            connection.deviceId = deviceId;
          } else {
            delete connection.deviceId;
          }
          connection.lastHeartbeat = Date.now();
          activeClientId = uid;
          return activeClientId;
        } catch {
          try {
            socket.close(1008, "Invalid auth token");
          } catch {
            // ignore close failures
          }
          return activeClientId;
        }
      }

      const nextClientId = normalizeClientId(obj);
      if (nextClientId) {
        const connection = clientSockets.get(nextClientId);
        if (!connection || connection.socket !== socket) {
          registerClientById(nextClientId, socket);
        } else {
          connection.lastHeartbeat = Date.now();
        }

        activeClientId = nextClientId;
      } else if (registeredClientId) {
        const connection = clientSockets.get(registeredClientId);
        if (connection && connection.socket === socket) {
          connection.lastHeartbeat = Date.now();
        }
      }

      if (obj.type === "auth" && typeof obj.token === "string" && activeClientId) {
        try {
          const decoded = await adminAuth.verifyIdToken(obj.token);
          const userSnap = await db.collection("users").doc(decoded.uid).get();
          const deviceId = userSnap.exists ? (userSnap.data()?.device_id as string | undefined) : undefined;
          if (deviceId) {
            const conn = clientSockets.get(activeClientId);
            if (conn?.socket === socket) conn.deviceId = deviceId;
          }
        } catch {
          // invalid token — deviceId stays unset, no telemetry delivered
        }
      }
    }
  } catch {
    // ignore malformed non-JSON packets
  }

  return activeClientId;
}
