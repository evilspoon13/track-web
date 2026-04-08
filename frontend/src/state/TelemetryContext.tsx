import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { LiveLogLine } from "../types";

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";
const MAX_HISTORY = 30;
const MAX_RAW_MESSAGES = 500;
const RECONNECT_DELAY_MS = 1000;

interface TelemetryState {
  signals: Record<string, number[]>;
  rawMessages: LiveLogLine[];
  connected: boolean;
}

const TelemetryContext = createContext<TelemetryState>({ signals: {}, rawMessages: [], connected: false });

export function useTelemetry() {
  return useContext(TelemetryContext);
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [signals, setSignals] = useState<Record<string, number[]>>({});
  const [rawMessages, setRawMessages] = useState<LiveLogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const rawBufRef = useRef<LiveLogLine[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let disposed = false;

    const flushRawMessages = () => {
      flushTimerRef.current = null;
      if (rawBufRef.current.length === 0) return;
      const pending = rawBufRef.current;
      rawBufRef.current = [];
      setRawMessages((prev) => {
        const merged = [...prev, ...pending];
        return merged.length > MAX_RAW_MESSAGES
          ? merged.slice(merged.length - MAX_RAW_MESSAGES)
          : merged;
      });
    };

    const connect = () => {
      if (disposed) return;

      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/client`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (AUTH_ENABLED) {
          import("../lib/firebase").then(({ auth }) => {
            const user = auth.currentUser;
            if (!user) {
              console.warn("[telemetry] No currentUser — WS stays unauthenticated");
              return;
            }
            if (ws.readyState !== WebSocket.OPEN) return;
            user.getIdToken().then((token) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(JSON.stringify({ type: "auth", token, client_id: user.uid }));
            }).catch((err) => {
              console.warn("[telemetry] Failed to get ID token:", err);
            });
          }).catch((err) => {
            console.warn("[telemetry] Failed to import firebase:", err);
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload: { signals?: Record<string, number> };
          };
          console.log("[TelemetryWS] message:", msg.type, msg.payload);
          if (msg.type !== "Telemetry") return;
          const incoming = msg.payload?.signals ?? {};
          const now = Date.now();

          setSignals((prev) => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(incoming)) {
              const arr = prev[key] ?? [];
              next[key] = [...arr.slice(-(MAX_HISTORY - 1)), val];
            }
            return next;
          });

          for (const [key, val] of Object.entries(incoming)) {
            rawBufRef.current.push({ ts: now, key, value: val });
          }
          if (flushTimerRef.current === null) {
            flushTimerRef.current = window.setTimeout(flushRawMessages, 50);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        setConnected(false);
        if (!disposed) {
          reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return (
    <TelemetryContext.Provider value={{ signals, rawMessages, connected }}>
      {children}
    </TelemetryContext.Provider>
  );
}
