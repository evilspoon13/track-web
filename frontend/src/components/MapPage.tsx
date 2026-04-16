import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import { useTelemetry } from "../state/TelemetryContext";
import type { GpsPoint } from "../types";

const EARTH_R_M = 6371e3;
const toRad = (deg: number) => (deg * Math.PI) / 180;

const LAP_MIN_AWAY_M = 100;
const LAP_CLOSE_M = 15;
const MAX_VISIBLE_LAPS = 4;

// Index 0 = current/live. Older laps progress through cool → warm hues so
// the newest lap reads as the live one and oldest stands out as "aged".
const LAP_COLORS = [
  "#22c55e", // green-500 — current
  "#3b82f6", // blue-500   — -1 lap
  "#eab308", // yellow-500 — -2 laps
  "#ef4444", // red-500    — -3 laps (oldest visible)
];

type ProjPoint = { x: number; y: number };
type ViewBox = { x: number; y: number; w: number; h: number };

type VisibleLap = {
  points: ProjPoint[];
  colorIndex: number;         // 0 (current) .. 3 (oldest visible)
  durationMs: number | null;  // null while in-progress
};

function project(refLat: number, refLon: number, lat: number, lon: number): ProjPoint {
  const refLatRad = toRad(refLat);
  return {
    x: toRad(lon - refLon) * Math.cos(refLatRad) * EARTH_R_M,
    y: -toRad(lat - refLat) * EARTH_R_M,
  };
}

export default function MapPage() {
  const { gpsSession, latestGps } = useTelemetry();

  const projectedPoints = useMemo<ProjPoint[]>(() => {
    const ref = gpsSession[0];
    if (!ref) return [];
    return gpsSession.map((p) => project(ref.lat, ref.lon, p.lat, p.lon));
  }, [gpsSession]);

  const { visibleLaps, currentLapStartTs } = useMemo(() => {
    if (projectedPoints.length === 0) {
      return { visibleLaps: [] as VisibleLap[], currentLapStartTs: 0 };
    }

    // Lap detection: index 0 always opens lap 1. A lap closes when the
    // trace returns within LAP_CLOSE_M of the session origin after having
    // first travelled > LAP_MIN_AWAY_M from it.
    const boundaries: number[] = [0];
    let hasLeftStart = false;
    for (let i = 1; i < projectedPoints.length; i++) {
      const p = projectedPoints[i]!;
      const d = Math.hypot(p.x, p.y);
      if (d > LAP_MIN_AWAY_M) hasLeftStart = true;
      if (hasLeftStart && d < LAP_CLOSE_M) {
        boundaries.push(i);
        hasLeftStart = false;
      }
    }

    const totalLaps = boundaries.length;
    const numCompleted = totalLaps - 1;
    const firstVisibleLapIdx = Math.max(0, totalLaps - MAX_VISIBLE_LAPS);

    const visible: VisibleLap[] = [];
    for (let lapIdx = firstVisibleLapIdx; lapIdx < totalLaps; lapIdx++) {
      const startIdx = boundaries[lapIdx]!;
      const isCurrent = lapIdx === numCompleted;
      const nextBoundary = isCurrent ? undefined : boundaries[lapIdx + 1];
      // Include the boundary point in both adjacent laps so polylines join
      // visually without a one-segment gap at the start/finish crossing.
      const endExclusive = nextBoundary !== undefined ? nextBoundary + 1 : projectedPoints.length;
      const points = projectedPoints.slice(startIdx, endExclusive);
      const colorIndex = totalLaps - 1 - lapIdx;

      let durationMs: number | null = null;
      if (!isCurrent && nextBoundary !== undefined) {
        const first = gpsSession[startIdx];
        const last = gpsSession[nextBoundary];
        if (first && last) durationMs = last.receivedAt - first.receivedAt;
      }
      visible.push({ points, colorIndex, durationMs });
    }

    const currentStartGps = gpsSession[boundaries[numCompleted]!];
    return {
      visibleLaps: visible,
      currentLapStartTs: currentStartGps ? currentStartGps.receivedAt : 0,
    };
  }, [gpsSession, projectedPoints]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <MapCanvas laps={visibleLaps} allPoints={projectedPoints} />
      {projectedPoints.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-4">
          <LapBoard laps={visibleLaps} currentLapStartTs={currentLapStartTs} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start p-4">
        <OverlayCard latest={latestGps} />
      </div>
    </div>
  );
}

function MapCanvas({ laps, allPoints }: { laps: VisibleLap[]; allPoints: ProjPoint[] }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: -50, y: -50, w: 100, h: 100 });

  useEffect(() => {
    if (!autoFit || allPoints.length === 0) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of allPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const w = Math.max(maxX - minX, 20);
    const h = Math.max(maxY - minY, 20);
    const padX = w * 0.1;
    const padY = h * 0.1;
    setViewBox({
      x: cx - w / 2 - padX,
      y: cy - h / 2 - padY,
      w: w + 2 * padX,
      h: h + 2 * padY,
    });
  }, [autoFit, allPoints]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setAutoFit(false);
      const rect = el.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width;
      const cy = (e.clientY - rect.top) / rect.height;
      setViewBox((vb) => {
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        const newW = Math.max(20, Math.min(50000, vb.w * factor));
        const newH = (newW / vb.w) * vb.h;
        const newX = vb.x + (vb.w - newW) * cx;
        const newY = vb.y + (vb.h - newH) * cy;
        return { x: newX, y: newY, w: newW, h: newH };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const dragStartRef = useRef<{ vb: ViewBox; px: number; py: number; rect: DOMRect } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    dragStartRef.current = {
      vb: viewBox,
      px: e.clientX,
      py: e.clientY,
      rect: canvasRef.current.getBoundingClientRect(),
    };
    setAutoFit(false);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { vb, px, py, rect } = dragStartRef.current;
      const dxPx = e.clientX - px;
      const dyPx = e.clientY - py;
      const dxM = (dxPx / rect.width) * vb.w;
      const dyM = (dyPx / rect.height) * vb.h;
      setViewBox({ x: vb.x - dxM, y: vb.y - dyM, w: vb.w, h: vb.h });
    };
    const onUp = () => {
      dragStartRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const lastPoint = allPoints.length > 0 ? allPoints[allPoints.length - 1] : null;

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full cursor-grab overflow-hidden select-none active:cursor-grabbing"
      style={{
        backgroundColor: "rgb(3, 7, 18)",
        backgroundImage:
          "linear-gradient(to right, rgb(31, 41, 55) 1px, transparent 1px), linear-gradient(to bottom, rgb(31, 41, 55) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
      onMouseDown={onMouseDown}
    >
      {allPoints.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-gray-600">Waiting for GPS</span>
        </div>
      ) : (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {laps.map((lap, i) => (
            <polyline
              key={i}
              points={lap.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={LAP_COLORS[lap.colorIndex]}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={lap.colorIndex === 0 ? 0.95 : 0.7}
            />
          ))}
          {lastPoint && (
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="3"
              fill="#ef4444"
              className="animate-pulse"
            />
          )}
        </svg>
      )}
      {!autoFit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAutoFit(true);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-3 rounded border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
        >
          Re-center
        </button>
      )}
    </div>
  );
}

function LapBoard({ laps, currentLapStartTs }: { laps: VisibleLap[]; currentLapStartTs: number }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!currentLapStartTs) return;
    const update = () => setElapsedMs(Date.now() - currentLapStartTs);
    update();
    const interval = window.setInterval(update, 100);
    return () => window.clearInterval(interval);
  }, [currentLapStartTs]);

  if (laps.length === 0) return null;

  const completedDurations = laps
    .map((l) => l.durationMs)
    .filter((d): d is number => d !== null);
  const bestMs = completedDurations.length > 0 ? Math.min(...completedDurations) : null;

  // Display newest first (current on top). laps is ordered oldest-first.
  const rows = [...laps].reverse();

  return (
    <div className="min-w-[300px] rounded-xl border border-gray-700 bg-gray-900 px-6 py-5 shadow-2xl">
      <div className="mb-3 text-sm font-medium tracking-[0.18em] text-gray-400">LAPS</div>
      <div className="space-y-2.5">
        {rows.map((lap, i) => {
          const isCurrent = lap.durationMs === null;
          const lapMs = isCurrent ? elapsedMs : (lap.durationMs as number);
          const isBest = !isCurrent && bestMs !== null && lap.durationMs === bestMs;
          const deltaMs =
            isCurrent || bestMs === null || isBest
              ? null
              : (lap.durationMs as number) - bestMs;
          return (
            <div key={i} className="flex items-center gap-4">
              <div
                className="h-3.5 w-3.5 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: LAP_COLORS[lap.colorIndex] }}
              />
              <span className="w-20 tabular-nums text-2xl font-semibold text-white">
                {(lapMs / 1000).toFixed(1)}s
              </span>
              <span
                className={
                  "w-20 text-right text-lg font-semibold tabular-nums " +
                  (isCurrent
                    ? "text-green-400"
                    : isBest
                    ? "text-yellow-300"
                    : "text-gray-400")
                }
              >
                {isCurrent
                  ? "Live"
                  : isBest
                  ? "Best"
                  : deltaMs !== null
                  ? `${deltaMs >= 0 ? "+" : ""}${(deltaMs / 1000).toFixed(1)}s`
                  : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverlayCard({ latest }: { latest: GpsPoint | null }) {
  const [fixAge, setFixAge] = useState(0);

  useEffect(() => {
    if (!latest) return;
    const update = () => setFixAge(Math.floor((Date.now() - latest.receivedAt) / 1000));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [latest]);

  if (!latest) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-700 bg-gray-900 px-6 py-4 shadow-2xl">
        <span className="text-sm text-gray-500">Waiting for GPS</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-8 rounded-xl border border-gray-700 bg-gray-900 px-6 py-4 shadow-2xl">
      <div className="flex flex-col">
        <span className="text-xs tracking-[0.18em] text-gray-500">SPEED</span>
        <span className="text-3xl font-semibold tabular-nums text-white">
          {latest.speed_kmh.toFixed(1)}
          <span className="ml-1 text-sm text-gray-500">km/h</span>
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs tracking-[0.18em] text-gray-500">HEADING</span>
        <div className="flex items-center gap-2">
          <Navigation
            size={22}
            className="text-blue-400"
            style={{ transform: `rotate(${latest.heading}deg)` }}
          />
          <span className="text-2xl font-semibold tabular-nums text-white">
            {Math.round(latest.heading)}°
          </span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-xs tracking-[0.18em] text-gray-500">POSITION</span>
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-semibold tabular-nums text-white">
            {latest.lat.toFixed(5)}°
          </span>
          <span className="text-xl font-semibold tabular-nums text-white">
            {latest.lon.toFixed(5)}°
          </span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-xs tracking-[0.18em] text-gray-500">FIX AGE</span>
        <span className="text-lg font-semibold tabular-nums text-gray-400">{fixAge}s ago</span>
      </div>
    </div>
  );
}
