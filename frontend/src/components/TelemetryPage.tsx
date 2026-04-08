import { useEditorState } from "../state/EditorContext";
import { useTelemetry } from "../state/TelemetryContext";
import type { FrameParserConfig } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSignalMeta(key: string, fpc: FrameParserConfig) {
  const colonIdx = key.indexOf(":");
  const canIdHex = "0x" + parseInt(key.slice(0, colonIdx), 10).toString(16);
  const signalName = key.slice(colonIdx + 1);
  const frame = fpc[canIdHex];
  return { frameLabel: frame?.can_id_label ?? canIdHex, signalName, canIdHex };
}

// ─── GraphCard ────────────────────────────────────────────────────────────────

function GraphCard({
  frameLabel,
  signalName,
  values,
}: {
  frameLabel: string;
  signalName: string;
  values: number[];
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

  const color = current !== undefined ? "text-white" : "text-white";

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

// ─── SignalCard ──────────────────────────────────────────────────────────────

function SignalCard({
  signalKey,
  fpc,
  values,
}: {
  signalKey: string;
  fpc: FrameParserConfig;
  values: number[];
}) {
  const { frameLabel, signalName } = getSignalMeta(signalKey, fpc);
  return <GraphCard frameLabel={frameLabel} signalName={signalName} values={values} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TelemetryPage() {
  const { frameParserConfig } = useEditorState();
  const { signals: history, connected } = useTelemetry();

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
                  <SignalCard
                    signalKey={key}
                    fpc={frameParserConfig}
                    values={history[key] ?? []}
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
