import { v4 as uuidv4 } from "uuid";

export class DeviceNotRegisteredError extends Error {
  constructor() { super("Device not registered"); }
}
import type {
  SavedLayout,
  PlacedWidget,
  FrameParserConfig,
  DataFieldType,
  WidgetType,
} from "../types";

// Backend API shapes (mirrors graphics.types.ts)
interface BackendWidgetInfo {
  type: string;
  alarm: boolean;
  position: { x: number; y: number; width: number; height: number };
  data: {
    can_id: number;
    can_id_label: string;
    signal: string;
    unit: DataFieldType;
    min: number;
    max: number;
    caution_threshold: number;
    critical_threshold: number;
  };
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
): BackendWidgetInfo {
  return {
    type: w.type,
    alarm: w.alarm ?? false,
    position: { x: w.col, y: w.row, width: w.cols, height: w.rows },
    data: {
      can_id: parseInt(w.widgetCanId ?? "0x0", 16),
      can_id_label: fpc[w.widgetCanId ?? ""]?.can_id_label ?? "",
      signal: w.widgetSignal ?? "",
      unit: w.widgetUnit ?? "rpm",
      min: w.widgetMin ?? 0,
      max: w.widgetMax ?? 100,
      caution_threshold: w.widgetCautionThreshold ?? 0,
      critical_threshold: w.widgetCriticalThreshold ?? 0,
    },
  };
}

function widgetFromBackend(wi: BackendWidgetInfo): PlacedWidget {
  return {
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
    widgets: screen.widgets.map((w) => widgetToBackend(w, frameParserConfig)),
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

export async function getDriverDisplay(): Promise<string | null> {
  try {
    const res = await authFetch("/api/graphics/driver-display");
    if (!res.ok) return null;
    const data = await res.json() as { driverDisplayScreen: string | null };
    return data.driverDisplayScreen;
  } catch {
    return null;
  }
}

export async function setDriverDisplay(screenName: string | null): Promise<void> {
  await authFetch("/api/graphics/driver-display", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ screenName }),
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
