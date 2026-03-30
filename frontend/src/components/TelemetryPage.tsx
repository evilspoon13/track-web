import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { useEditorState } from "../state/EditorContext";
import type { FrameParserConfig, PlacedWidget, ScreenState } from "../types";

const MAX_HISTORY = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSignalMeta(key: string, fpc: FrameParserConfig) {
  const colonIdx = key.indexOf(":");
  const canIdHex = "0x" + parseInt(key.slice(0, colonIdx), 10).toString(16);
  const signalName = key.slice(colonIdx + 1);
  const frame = fpc[canIdHex];
  return { frameLabel: frame?.can_id_label ?? canIdHex, signalName, canIdHex };
}

function getWidgetForSignal(
  canIdHex: string,
  signalName: string,
  screens: ScreenState[],
  driverDisplayScreen: string | null
): PlacedWidget | undefined {
  const screen = screens.find((s) => s.name === driverDisplayScreen);
  return screen?.widgets.find(
    (w) => w.widgetCanId === canIdHex && w.widgetSignal === signalName
  );
}

function valueColor(current: number | undefined, widget: PlacedWidget | undefined): string {
  if (current === undefined) return "text-white";
  if (widget?.widgetCriticalThreshold !== undefined && current >= widget.widgetCriticalThreshold)
    return "text-red-400";
  if (widget?.widgetCautionThreshold !== undefined && current >= widget.widgetCautionThreshold)
    return "text-amber-400";
  return "text-white";
}

// ─── GraphCard ────────────────────────────────────────────────────────────────

function GraphCard({
  frameLabel,
  signalName,
  values,
  widget,
}: {
  frameLabel: string;
  signalName: string;
  values: number[];
  widget: PlacedWidget | undefined;
}) {
  const W = 240;
  const H = 80;
  const current = values[values.length - 1];
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 1;
  const range = dataMax - dataMin || 1;
  const pct = (v: number) => (v - dataMin) / range;
  const gradId = `grad-${frameLabel}-${signalName}`.replace(/\W+/g, "");

  const pts = values.map((v, i) => ({
    x: values.length > 1 ? (i / (values.length - 1)) * W : W / 2,
    y: H - pct(v) * H,
  }));
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fillPath =
    pts.length > 1
      ? `M${pts[0]!.x},${pts[0]!.y} ${pts.map((p) => `L${p.x},${p.y}`).join(" ")} L${pts[pts.length - 1]!.x},${H} L${pts[0]!.x},${H} Z`
      : "";

  const cautionY =
    widget?.widgetCautionThreshold !== undefined
      ? H - pct(widget.widgetCautionThreshold) * H
      : null;
  const criticalY =
    widget?.widgetCriticalThreshold !== undefined
      ? H - pct(widget.widgetCriticalThreshold) * H
      : null;

  const color = valueColor(current, widget);

  return (
    <div className="bg-gray-950 rounded-xl p-4 flex flex-col gap-3 w-full h-full">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500 uppercase leading-tight">
          {frameLabel}
          <br />
          {signalName}
        </span>
        <span className={`text-2xl font-bold tabular-nums leading-none ${color}`}>
          {current !== undefined ? current.toFixed(2) : "—"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {cautionY !== null && (
          <line
            x1={0} y1={cautionY} x2={W} y2={cautionY}
            stroke="#fbbf24" strokeWidth="0.75" strokeDasharray="4,3"
          />
        )}
        {criticalY !== null && (
          <line
            x1={0} y1={criticalY} x2={W} y2={criticalY}
            stroke="#ef4444" strokeWidth="0.75" strokeDasharray="4,3"
          />
        )}
        {fillPath && <path d={fillPath} fill={`url(#${gradId})`} />}
        {pts.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}

// ─── NumberCard ───────────────────────────────────────────────────────────────

function NumberCard({
  frameLabel,
  signalName,
  values,
  widget,
}: {
  frameLabel: string;
  signalName: string;
  values: number[];
  widget: PlacedWidget | undefined;
}) {
  const current = values[values.length - 1];
  const color = valueColor(current, widget);
  return (
    <div className="bg-gray-950 rounded-xl p-4 flex flex-col justify-between w-full h-full">
      <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500 uppercase">
        {frameLabel} / {signalName}
      </span>
      <span className={`text-4xl font-bold tabular-nums leading-none mt-3 ${color}`}>
        {current !== undefined ? current.toFixed(2) : "—"}
      </span>
    </div>
  );
}

// ─── GaugeCard ────────────────────────────────────────────────────────────────

function GaugeCard({
  frameLabel,
  signalName,
  values,
  widget,
}: {
  frameLabel: string;
  signalName: string;
  values: number[];
  widget: PlacedWidget | undefined;
}) {
  const current = values[values.length - 1];
  const min = widget?.widgetMin ?? 0;
  const max = widget?.widgetMax ?? Math.max(...values, min + 1);
  const pct = Math.min(1, Math.max(0, ((current ?? min) - min) / (max - min)));

  const cx = 60, cy = 64, r = 44;
  const SWEEP_DEG = 260;
  const START_DEG = 140;
  const circumference = 2 * Math.PI * r;
  const trackLength = (SWEEP_DEG / 360) * circumference;
  const fillLength = pct * trackLength;

  const color = valueColor(current, widget);
  const strokeColor =
    widget?.widgetCriticalThreshold !== undefined && (current ?? 0) >= widget.widgetCriticalThreshold
      ? "#ef4444"
      : widget?.widgetCautionThreshold !== undefined && (current ?? 0) >= widget.widgetCautionThreshold
      ? "#fbbf24"
      : "#60a5fa";

  return (
    <div className="bg-gray-950 rounded-xl p-4 flex flex-col items-center gap-1 w-full h-full">
      <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500 uppercase self-start">
        {frameLabel} / {signalName}
      </span>
      <svg viewBox="0 0 120 120" className="w-32 h-32">
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#1f2937"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${trackLength} ${circumference}`}
          transform={`rotate(${START_DEG} ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
          transform={`rotate(${START_DEG} ${cx} ${cy})`}
        />
        <text
          x={cx} y={cy + 6}
          textAnchor="middle"
          style={{ fontSize: 18, fontWeight: "bold", fill: color === "text-red-400" ? "#f87171" : color === "text-amber-400" ? "#fbbf24" : "#ffffff" }}
        >
          {current !== undefined ? current.toFixed(1) : "—"}
        </text>
        <text x={18} y={108} style={{ fontSize: 8, fill: "#374151" }}>{min}</text>
        <text x={90} y={108} textAnchor="end" style={{ fontSize: 8, fill: "#374151" }}>{max}</text>
      </svg>
    </div>
  );
}

// ─── BarCard ──────────────────────────────────────────────────────────────────

function BarCard({
  frameLabel,
  signalName,
  values,
  widget,
}: {
  frameLabel: string;
  signalName: string;
  values: number[];
  widget: PlacedWidget | undefined;
}) {
  const current = values[values.length - 1];
  const min = widget?.widgetMin ?? 0;
  const max = widget?.widgetMax ?? Math.max(...values, min + 1);
  const pct = Math.min(1, Math.max(0, ((current ?? min) - min) / (max - min)));
  const cautionPct =
    widget?.widgetCautionThreshold !== undefined
      ? (widget.widgetCautionThreshold - min) / (max - min)
      : null;
  const criticalPct =
    widget?.widgetCriticalThreshold !== undefined
      ? (widget.widgetCriticalThreshold - min) / (max - min)
      : null;
  const color = valueColor(current, widget);

  return (
    <div className="bg-gray-950 rounded-xl p-4 flex flex-col justify-between gap-3 w-full h-full">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500 uppercase leading-tight">
          {frameLabel}
          <br />
          {signalName}
        </span>
        <span className={`text-2xl font-bold tabular-nums leading-none ${color}`}>
          {current !== undefined ? current.toFixed(2) : "—"}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-400"
          style={{ width: `${pct * 100}%` }}
        />
        {cautionPct !== null && (
          <div
            className="absolute inset-y-0 w-px bg-amber-400"
            style={{ left: `${cautionPct * 100}%` }}
          />
        )}
        {criticalPct !== null && (
          <div
            className="absolute inset-y-0 w-px bg-red-400"
            style={{ left: `${criticalPct * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-gray-700">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─── IndicatorCard ────────────────────────────────────────────────────────────

function IndicatorCard({
  frameLabel,
  signalName,
  values,
  widget,
}: {
  frameLabel: string;
  signalName: string;
  values: number[];
  widget: PlacedWidget | undefined;
}) {
  const current = values[values.length - 1];
  const color = valueColor(current, widget);
  const dotColor =
    color === "text-red-400"
      ? "bg-red-500"
      : color === "text-amber-400"
      ? "bg-amber-400"
      : "bg-green-500";

  return (
    <div className="bg-gray-950 rounded-xl p-4 flex items-center gap-4 w-full h-full">
      <div className={`h-5 w-5 rounded-full flex-shrink-0 ${dotColor}`} />
      <div className="flex flex-col">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500 uppercase">
          {frameLabel}
        </span>
        <span className="text-sm font-mono text-gray-400">{signalName}</span>
        <span className={`text-lg font-bold tabular-nums ${color}`}>
          {current !== undefined ? current.toFixed(2) : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── SmartSignalCard ──────────────────────────────────────────────────────────

function SmartSignalCard({
  signalKey,
  fpc,
  values,
  screens,
  driverDisplayScreen,
}: {
  signalKey: string;
  fpc: FrameParserConfig;
  values: number[];
  screens: ScreenState[];
  driverDisplayScreen: string | null;
}) {
  const { frameLabel, signalName, canIdHex } = getSignalMeta(signalKey, fpc);
  const widget = getWidgetForSignal(canIdHex, signalName, screens, driverDisplayScreen);

  const props = { frameLabel, signalName, values, widget };

  switch (widget?.type) {
    case "gauge":     return <GaugeCard {...props} />;
    case "bar":       return <BarCard {...props} />;
    case "number":    return <NumberCard {...props} />;
    case "indicator": return <IndicatorCard {...props} />;
    default:          return <GraphCard {...props} />;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TelemetryPage() {
  const { frameParserConfig, screens, driverDisplayScreen } = useEditorState();
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/client`);

    ws.onopen = () => {
      setConnected(true);
      const uid = auth.currentUser?.uid;
      auth.currentUser?.getIdToken().then((token) => {
        ws.send(JSON.stringify({ type: "auth", token, client_id: uid ?? "browser" }));
      });
    };

    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          payload: { signals?: Record<string, number> };
        };
        if (msg.type !== "Telemetry") return;
        const signals = msg.payload?.signals ?? {};
        setHistory((prev) => {
          const next = { ...prev };
          for (const [key, val] of Object.entries(signals)) {
            const arr = prev[key] ?? [];
            next[key] = [...arr.slice(-(MAX_HISTORY - 1)), val];
          }
          return next;
        });
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, []);

  const signalKeys = Object.keys(history);
  const n = signalKeys.length;
  const cols = n <= 1 ? 1 : n < 9 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const remainder = n % cols;
  const lastRowStart = remainder === 0 ? n : n - remainder;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-900">
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-gray-800 px-6">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500">LIVE TELEMETRY</span>
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-blue-400" : "bg-gray-600"}`} />
          <span className="text-[10px] font-mono text-gray-600">{connected ? "LIVE" : "NO SIGNAL"}</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-3">
        {n === 0 ? (
          <div className="flex h-full items-center justify-center text-[10px] font-mono text-gray-600">
            waiting for telemetry...
          </div>
        ) : (
          <div
            className="grid gap-3 h-full"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {signalKeys.map((key, i) => {
              const span = remainder === 1 && i >= lastRowStart ? cols : 1;
              return (
                <div key={key} className="h-full" style={span > 1 ? { gridColumn: `span ${span}` } : undefined}>
                  <SmartSignalCard
                    signalKey={key}
                    fpc={frameParserConfig}
                    values={history[key] ?? []}
                    screens={screens}
                    driverDisplayScreen={driverDisplayScreen}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
