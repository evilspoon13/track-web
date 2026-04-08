import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";
const MAX_HISTORY = 30;
const RECONNECT_DELAY_MS = 1000;

interface TelemetryState {
  signals: Record<string, number[]>;
  connected: boolean;
}

const TelemetryContext = createContext<TelemetryState>({ signals: {}, connected: false });

export function useTelemetry() {
  return useContext(TelemetryContext);
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [signals, setSignals] = useState<Record<string, number[]>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/client`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (AUTH_ENABLED) {
          import("../lib/firebase").then(({ auth }) => {
            const user = auth.currentUser;
            if (!user || ws.readyState !== WebSocket.OPEN) return;
            user.getIdToken().then((token) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(JSON.stringify({ type: "auth", token, client_id: user.uid }));
            }).catch(() => {
              // ignore auth token fetch failures and continue receiving telemetry
            });
          }).catch(() => {
            // ignore lazy import failures and continue receiving telemetry
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload: { signals?: Record<string, number> };
          };
          if (msg.type !== "Telemetry") return;
          const incoming = msg.payload?.signals ?? {};
          setSignals((prev) => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(incoming)) {
              const arr = prev[key] ?? [];
              next[key] = [...arr.slice(-(MAX_HISTORY - 1)), val];
            }
            return next;
          });
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
    <TelemetryContext.Provider value={{ signals, connected }}>
      {children}
    </TelemetryContext.Provider>
  );
}
