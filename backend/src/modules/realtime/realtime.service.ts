import { type RawData, WebSocket } from "ws";
import type { PiConnection, ClientConnection } from "./realtime.types";
import { persistLogBuffer } from "../logs/logs.service";

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
let currentPi: WebSocket | null = null;
const PI_DEADLINE_MS = 20_000;
const PI_MONITOR_INTERVAL_MS = 5_000;

setInterval(() => {
  const now = Date.now();
  for (const [piId, connection] of piSockets.entries()) {
    const ageMs = now - connection.lastHeartbeat;
    if (ageMs > PI_DEADLINE_MS) {
      console.log(`[ws] Pi ${piId} stale (${ageMs}ms). dropping`);
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
      console.warn(`[logs] dropping stale upload session: ${session.filename}`);
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
    piSockets.delete(existingForSocket);
  }

  const existing = piSockets.get(piId);
  if (existing) {
    if (existing.socket !== socket) {
      try {
        existing.socket.close(1000, "Pi web socket replaced");
      } catch {
        // ignore close failures
      }
    }

    existing.connectedAt = Date.now();
    existing.lastHeartbeat = Date.now();
    existing.socket = socket;
    socketToPiId.set(socket, piId);
    piSockets.set(piId, existing);
    currentPi = socket;
    return existing;
  }

  const connection: PiConnection = {
    socket,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  piSockets.set(piId, connection);
  socketToPiId.set(socket, piId);
  currentPi = socket;
  return connection;
}

function registerClientById(clientId: string, socket: WebSocket): ClientConnection {
  const existingForSocket = socketToClientId.get(socket);
  if (existingForSocket && existingForSocket !== clientId) {
    clientSockets.delete(existingForSocket);
  }

  const existing = clientSockets.get(clientId);
  if (existing) {
    if (existing.socket !== socket) {
      try {
        existing.socket.close(1000, "Client web socket replaced");
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

export function disconnectPi(piId: string) {
  const connection = piSockets.get(piId);
  if (!connection) {
    return;
  }

  if (currentPi === connection.socket) {
    currentPi = null;
  }

  if (socketToPiId.get(connection.socket) === piId) {
    socketToPiId.delete(connection.socket);
  }

  piSockets.delete(piId);
}

export function disconnectClient(id: string) {
  const connection = clientSockets.get(id);
  if (!connection) {
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
              if (clientConnection.socket.readyState === WebSocket.OPEN) {
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
        console.log(`[logs] upload start: ${filename} (${fileSize} bytes)`);
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
          console.warn(`[logs] incomplete upload: ${filename} got ${session.chunks.size}/${totalChunks}`);
          return activePiId;
        }

        const ordered: Buffer[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const chunk = session.chunks.get(i);
          if (!chunk) {
            console.warn(`[logs] missing chunk ${i} for ${filename}`);
            return activePiId;
          }
          ordered.push(chunk);
        }

        const sessionName = filename.replace(/\.bin$/, "");
        persistLogBuffer(deviceId, sessionName, Buffer.concat(ordered)).catch(console.error);
        console.log(`[logs] upload complete: ${filename} (${totalChunks} chunks)`);
      }
    }
  } catch {
    // ignore malformed non-JSON packets
  }
  return activePiId;
}

export function handleClientMessage(
  socket: WebSocket,
  data: RawData,
  registeredClientId?: string
): string | undefined {
  const message = data.toString();
  let activeClientId = registeredClientId;

  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as { client_id?: unknown };
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
    }
  } catch {
    // ignore malformed non-JSON packets
  }

  if (activeClientId && currentPi && currentPi.readyState == WebSocket.OPEN) {
    currentPi.send(JSON.stringify({ type: "config:update", payload: "New update incoming: " + message }));
  }

  return activeClientId;
}