import { WebSocket } from "ws";

export interface BaseConnection {
  socket: WebSocket;
  connectedAt: number;
  lastHeartbeat: number;
}

export interface ClientConnection extends BaseConnection {
  uid?: string;
  deviceId?: string;
}
export interface PiConnection extends BaseConnection {}
