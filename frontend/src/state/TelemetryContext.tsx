import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { GpsPoint, LiveLogLine } from "../types";
import { useEditorDispatch } from "./EditorContext";
import { screenFromBackendPayload } from "../utils/layoutIO";

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";
const MAX_HISTORY = 30;
const MAX_RAW_MESSAGES = 500;
const RECONNECT_DELAY_MS = 1000;
const GPS_NO_FRAME_TIMEOUT_MS = 30000;
const GPS_LOW_SPEED_TIMEOUT_MS = 60000;
const GPS_LOW_SPEED_THRESHOLD_KMH = 1;

interface TelemetryState {
  signals: Record<string, number[]>;
  rawMessages: LiveLogLine[];
  connected: boolean;
  latestGps: GpsPoint | null;
  gpsSession: GpsPoint[];
}

const TelemetryContext = createContext<TelemetryState>({
  signals: {},
  rawMessages: [],
  connected: false,
  latestGps: null,
  gpsSession: [],
});

export function useTelemetry() {
  return useContext(TelemetryContext);
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const editorDispatch = useEditorDispatch();
  const [signals, setSignals] = useState<Record<string, number[]>>({});
  const [rawMessages, setRawMessages] = useState<LiveLogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [latestGps, setLatestGps] = useState<GpsPoint | null>(null);
  const [gpsSession, setGpsSession] = useState<GpsPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const rawBufRef = useRef<LiveLogLine[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const latestGpsRef = useRef<GpsPoint | null>(null);
  const lastGpsReceivedAtRef = useRef<number>(0);
  const lowSpeedSinceRef = useRef<number | null>(null);

  useEffect(() => {
    latestGpsRef.current = latestGps;
  }, [latestGps]);

  // Session-end detector: clear the current trace when the car has been
  // stopped for 60 s or GPS frames stop arriving for 30 s. Next fix starts
  // a fresh session automatically.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const latest = latestGpsRef.current;
      if (!latest) {
        lowSpeedSinceRef.current = null;
        return;
      }
      const now = Date.now();
      const endSession = () => {
        setGpsSession([]);
        setLatestGps(null);
        lowSpeedSinceRef.current = null;
      };
      if (now - lastGpsReceivedAtRef.current > GPS_NO_FRAME_TIMEOUT_MS) {
        endSession();
        return;
      }
      if (latest.speed_kmh < GPS_LOW_SPEED_THRESHOLD_KMH) {
        if (lowSpeedSinceRef.current === null) {
          lowSpeedSinceRef.current = now;
        } else if (now - lowSpeedSinceRef.current > GPS_LOW_SPEED_TIMEOUT_MS) {
          endSession();
        }
      } else {
        lowSpeedSinceRef.current = null;
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

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
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          const type = msg.type;

          if (type === "screen_deleted" && typeof msg.name === "string") {
            editorDispatch({ type: "REMOVE_SCREEN_BY_NAME", payload: { name: msg.name } });
            return;
          }

          if (type === "screen_updated" && msg.screen && typeof msg.screen === "object") {
            try {
              const { name, widgets } = screenFromBackendPayload(
                msg.screen as Parameters<typeof screenFromBackendPayload>[0]
              );
              editorDispatch({ type: "UPSERT_SCREEN", payload: { name, widgets } });
            } catch {
              // ignore malformed screen payload
            }
            return;
          }

          if (type === "screen_prefs_updated" && msg.prefs && typeof msg.prefs === "object") {
            const p = msg.prefs as { pinnedNames?: unknown; order?: unknown };
            const pinnedNames = Array.isArray(p.pinnedNames)
              ? p.pinnedNames.filter((v): v is string => typeof v === "string")
              : [];
            const order = Array.isArray(p.order)
              ? p.order.filter((v): v is string => typeof v === "string")
              : [];
            editorDispatch({ type: "SET_SCREEN_PREFS", payload: { pinnedNames, order } });
            return;
          }

          if (type === "gps") {
            const payload = msg.payload as GpsPoint | undefined;
            if (!payload) {
              console.warn("[gps] frame missing payload, dropped", msg);
              return;
            }
            const point: GpsPoint = {
              lat: Number(payload.lat),
              lon: Number(payload.lon),
              speed_kmh: Number(payload.speed_kmh),
              heading: Number(payload.heading),
              ts: Number(payload.ts),
              gps_ts: Number(payload.gps_ts),
            };
            if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
              console.warn("[gps] invalid lat/lon, dropped", payload);
              return;
            }
            setLatestGps(point);
            lastGpsReceivedAtRef.current = Date.now();
            setGpsSession((prev) => [...prev, point]);
            return;
          }

          if (type !== "Telemetry") return;
          const payload = msg.payload as { signals?: Record<string, number> } | undefined;
          const incoming = payload?.signals ?? {};
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
    <TelemetryContext.Provider value={{ signals, rawMessages, connected, latestGps, gpsSession }}>
      {children}
    </TelemetryContext.Provider>
  );
}
