import { type RawData, WebSocket } from "ws";
import type { PiConnection, ClientConnection } from "./realtime.types";

let clientSockets = new Map<string, ClientConnection>();
const piSockets = new Map<string, PiConnection>();
let currentPi: WebSocket | null = null;
const PI_DEADLINE_MS = 20_000;
const PI_MONITOR_INTERVAL_MS = 5_000;

setInterval(() => {
  const now = Date.now();
  for (const [id, connection] of piSockets.entries()) {
    const ageMs = now - connection.lastHeartbeat;
    if (ageMs > PI_DEADLINE_MS) {
      console.log(`[ws] Pi ${id} stale (${ageMs}ms). dropping`);
      try {
        connection.socket.terminate();
      } catch {
        // ignore close failures
      }
      disconnectPi(id);
    }
  }
}, PI_MONITOR_INTERVAL_MS);

export function registerPi(id: string, socket: WebSocket) {
  const connection: PiConnection = {
    socket,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  piSockets.set(id, connection);
  currentPi = socket;
  return connection;
}

export function registerClient(id: string, socket: WebSocket) {
  const connection: ClientConnection = {
    socket,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  clientSockets.set(id, connection);
  return connection;
}

export function disconnectPi(id: string) {
  if (currentPi == piSockets.get(id)?.socket) {
    currentPi = null;
  }

  piSockets.delete(id);
}

export function disconnectClient(id: string) {
  clientSockets.delete(id);
}

export function handlePiMessage(id: string, data: RawData): void {
  const message = data.toString();
  const connection = piSockets.get(id);
  if (connection) {
    connection.lastHeartbeat = Date.now();
  }

  // Cloud bridge sends a heartbeat message every second like:
  // {"type":"heartbeat","status":"connected","ts":123,"device_id":"..."}
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object" && (parsed as { type?: string }).type === "heartbeat") {
      return;
    }
  } catch {
    // non-JSON messages fall through below
  }

  for (const connection of clientSockets.values()) {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(JSON.stringify({ type: "Telemetry", payload: message }));
    }
  }
}

export function handleClientMessage(id: string, data: RawData): void {
  const message = data.toString();

  if (currentPi && currentPi.readyState == WebSocket.OPEN) {
    currentPi.send(JSON.stringify({ type: "config:update", payload: "New update incoming: " + message }));
  }
}
