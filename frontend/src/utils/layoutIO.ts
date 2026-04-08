import { v4 as uuidv4 } from "uuid";

export class DeviceNotRegisteredError extends Error {
  constructor() { super("Device not registered"); }
}
import type {
  SavedLayout,
  PlacedWidget,
  FrameParserConfig,
  WidgetType,
  DaySummary,
  LogsResponse,
  GraphInfo,
  graphMode,
} from "../types";

// Backend API shapes (mirrors graphics.types.ts + frame-parser.types.ts)
interface BackendGraphInfo {
  mode: string;
  window_seconds?: number;
  max_points: number;
  x_can_id?: number;
  x_signal?: string;
  x_unit?: string;
  x_min?: number;
  x_max?: number;
}

interface BackendWidgetInfo {
  type: string;
  alarm: boolean;
  position: { x: number; y: number; width: number; height: number };
  data: {
    can_id: number;
    can_id_label: string;
    signal: string;
    unit: string;
    min: number;
    max: number;
    caution_threshold: number;
    critical_threshold: number;
  };
  graph?: BackendGraphInfo;
}

interface BackendScreenInfo {
  name: string;
  widgets: BackendWidgetInfo[];
}

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  if (import.meta.env.VITE_AUTH_ENABLED === "false") {
    return fetch(input, init);
  }
  const { auth } = await import("../lib/firebase");
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 403) throw new DeviceNotRegisteredError();
  return res;
}

function widgetToBackend(
  w: PlacedWidget,
  fpc: FrameParserConfig
): BackendWidgetInfo | null {
  const base: BackendWidgetInfo = {
    type: w.type,
    alarm: w.alarm ?? false,
    position: { x: w.col, y: w.row, width: w.cols, height: w.rows },
    data: {
      can_id: parseInt(w.widgetCanId ?? "0x0", 16),
      can_id_label: fpc[w.widgetCanId ?? ""]?.can_id_label ?? "",
      signal: w.widgetSignal ?? "",
      unit: w.widgetUnit ?? "",
      min: w.widgetMin ?? 0,
      max: w.widgetMax ?? 100,
      caution_threshold: w.widgetCautionThreshold ?? 0,
      critical_threshold: w.widgetCriticalThreshold ?? 0,
    },
  };

  if (w.type === "graph" && w.graphConfig) {
    const gc = w.graphConfig;
    const graph: BackendGraphInfo = {
      mode: gc.mode,
      max_points: gc.max_points,
    };
    if (gc.mode === "time_series") {
      graph.window_seconds = gc.window_seconds ?? 30;
    } else {
      graph.x_can_id = gc.x_can_id;
      graph.x_signal = gc.x_signal;
      graph.x_unit = gc.x_unit;
      graph.x_min = gc.x_min;
      graph.x_max = gc.x_max;
    }
    base.graph = graph;
  }

  return base;
}

function widgetFromBackend(wi: BackendWidgetInfo): PlacedWidget {
  const w: PlacedWidget = {
    id: uuidv4(),
    type: wi.type as WidgetType,
    col: wi.position.x,
    row: wi.position.y,
    cols: wi.position.width,
    rows: wi.position.height,
    alarm: wi.alarm,
    widgetCanId: "0x" + wi.data.can_id.toString(16),
    widgetSignal: wi.data.signal,
    widgetUnit: wi.data.unit,
    widgetMin: wi.data.min,
    widgetMax: wi.data.max,
    widgetCautionThreshold: wi.data.caution_threshold,
    widgetCriticalThreshold: wi.data.critical_threshold,
  };

  if (wi.type === "graph" && wi.graph) {
    const g = wi.graph;
    const graphConfig: GraphInfo = {
      mode: g.mode as graphMode,
      max_points: g.max_points,
      window_seconds: g.window_seconds,
      x_can_id: g.x_can_id,
      x_signal: g.x_signal,
      x_unit: g.x_unit,
      x_min: g.x_min,
      x_max: g.x_max,
    };
    w.graphConfig = graphConfig;
  }

  return w;
}

export async function listScreens(): Promise<string[]> {
  try {
    const res = await authFetch("/api/graphics/screens");
    if (res.status === 404) return [];
    const data = await res.json();
    return data.screens ?? [];
  } catch {
    return [];
  }
}

export async function loadScreen(name: string): Promise<SavedLayout | null> {
  try {
    const res = await authFetch(`/api/graphics/screens/${encodeURIComponent(name)}`);
    if (res.status === 404) return null;
    const screen: BackendScreenInfo = await res.json();
    return {
      name: screen.name,
      widgets: screen.widgets.map(widgetFromBackend),
    };
  } catch {
    return null;
  }
}

export async function saveScreen(
  screen: SavedLayout,
  frameParserConfig: FrameParserConfig
): Promise<void> {
  const payload: BackendScreenInfo = {
    name: screen.name,
    widgets: screen.widgets.map((w) => widgetToBackend(w, frameParserConfig)).filter((w): w is BackendWidgetInfo => w !== null),
  };
  await authFetch(`/api/graphics/screens/${encodeURIComponent(screen.name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteScreen(name: string): Promise<void> {
  await authFetch(`/api/graphics/screens/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function getDbc(): Promise<FrameParserConfig> {
  try {
    const res = await authFetch("/api/dbc");
    if (res.status === 404) return {};
    const data = await res.json() as { frames: FrameParserConfig };
    return data.frames ?? {};
  } catch {
    return {};
  }
}

export async function saveDbc(config: FrameParserConfig): Promise<void> {
  await authFetch("/api/dbc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frames: config }),
  });
}

export async function uploadDbc(rawContent: string): Promise<FrameParserConfig | { error: string }> {
  try {
    const res = await authFetch("/api/dbc/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: rawContent }),
    });
    if (!res.ok) {
      const data = await res.json() as { msg?: string };
      return { error: data.msg ?? "Upload failed" };
    }
    const data = await res.json() as { frames: FrameParserConfig };
    return data.frames ?? {};
  } catch {
    return { error: "Upload failed" };
  }
}

export async function fetchLogDays(): Promise<DaySummary[]> {
  try {
    const res = await authFetch("/api/logs/days");
    if (!res.ok) return [];
    const data = await res.json() as { days: DaySummary[] };
    return data.days ?? [];
  } catch {
    return [];
  }
}

export async function fetchLogs(opts: {
  date?: string;
  limit?: number;
  before?: number;
}): Promise<LogsResponse> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 100) });
  if (opts.date) params.set("date", opts.date);
  if (opts.before !== undefined) params.set("before", String(opts.before));
  try {
    const res = await authFetch(`/api/logs?${params.toString()}`);
    if (!res.ok) return { entries: [], nextCursor: null };
    return res.json() as Promise<LogsResponse>;
  } catch {
    return { entries: [], nextCursor: null };
  }
}
