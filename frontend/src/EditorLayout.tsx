import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { v4 as uuidv4 } from "uuid";
import { LogOut } from "lucide-react";
import { auth } from "./lib/firebase";
import { useEditorState, useEditorDispatch } from "./state/EditorContext";
import { authFetch } from "./utils/layoutIO";
import Navbar from "./components/Navbar";
import GridCanvas from "./components/GridCanvas";
import ConfigPanel from "./components/ConfigPanel";
import TelemetryPage from "./components/TelemetryPage";
import MapPage from "./components/MapPage";
import LogTerminalPage from "./components/LogTerminalPage";
import DevicePage from "./components/DevicePage";
import { defaultSize, allowedSizes } from "./utils/widgetDefaults";
import { pixelToGrid, hasCollision, clampToGrid } from "./utils/gridHelpers";
import { GRID_COLS, GRID_ROWS } from "./utils/widgetDefaults";
import type { WidgetType } from "./types";

const ASPECT_RATIO = GRID_COLS / GRID_ROWS;

interface EditorLayoutProps {
  onLogout: () => void;
}

export default function EditorLayout({ onLogout }: EditorLayoutProps) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [deviceConnected, setDeviceConnected] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    authFetch("/api/device")
      .then((r) => r.json())
      .then((data: { connected?: boolean }) => setDeviceConnected(data.connected))
      .catch(() => setDeviceConnected(undefined));
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState({ w: 80, h: 80 });
  const [page, setPage] = useState<"display" | "telemetry" | "map" | "logs" | "device">("display");
  const [activeType, setActiveType] = useState<WidgetType | null>(null);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const displayBtnRef = useRef<HTMLButtonElement>(null);
  const telemetryBtnRef = useRef<HTMLButtonElement>(null);
  const mapBtnRef = useRef<HTMLButtonElement>(null);
  const logsBtnRef = useRef<HTMLButtonElement>(null);
  const deviceBtnRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const availW = clientWidth - 32;
      const availH = clientHeight - 32;

      let canvasW = availW;
      let canvasH = canvasW / ASPECT_RATIO;
      if (canvasH > availH) {
        canvasH = availH;
        canvasW = canvasH * ASPECT_RATIO;
      }

      setCellSize({
        w: Math.floor(canvasW / GRID_COLS),
        h: Math.floor(canvasH / GRID_ROWS),
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = () => setSettingsOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [settingsOpen]);

  useLayoutEffect(() => {
    const container = tabsRef.current;
    const btn = page === "display" ? displayBtnRef.current : page === "telemetry" ? telemetryBtnRef.current : page === "map" ? mapBtnRef.current : page === "device" ? deviceBtnRef.current : logsBtnRef.current;
    if (!container || !btn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({ left: btnRect.left - containerRect.left, width: btnRect.width, ready: true });
  }, [page]);

  const screen = state.screens.find((s) => s.id === state.activeScreenId);
  const widgets = screen?.widgets ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as
      | { fromPalette: true; widgetType: WidgetType }
      | { fromPalette: false; widgetId: string };

    if (data.fromPalette) {
      setActiveType(data.widgetType);
      setActiveWidgetId(null);
    } else {
      setActiveWidgetId(data.widgetId);
      setActiveType(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event;
      setActiveType(null);
      setActiveWidgetId(null);

      if (!over || over.id !== "grid-canvas") return;

      const data = active.data.current as
        | { fromPalette: true; widgetType: WidgetType }
        | { fromPalette: false; widgetId: string };

      if (data.fromPalette) {
        const overRect = over.rect;
        const activeRect = active.rect.current.translated;
        if (!activeRect) return;

        const dropX = activeRect.left - overRect.left;
        const dropY = activeRect.top - overRect.top;

        const { col, row } = pixelToGrid(dropX, dropY, cellSize.w, cellSize.h);
        const widgetType = data.widgetType;

        const defaultWidgetSize = defaultSize[widgetType];
        let finalSize = defaultWidgetSize;
        let clamped = clampToGrid(col, row, defaultWidgetSize.cols, defaultWidgetSize.rows);

        if (hasCollision(clamped.col, clamped.row, defaultWidgetSize.cols, defaultWidgetSize.rows, widgets)) {
          const sizes = allowedSizes[widgetType];
          let foundFit = false;

          for (const size of sizes) {
            if (size.cols === defaultWidgetSize.cols && size.rows === defaultWidgetSize.rows) {
              continue;
            }

            const testClamped = clampToGrid(col, row, size.cols, size.rows);
            if (!hasCollision(testClamped.col, testClamped.row, size.cols, size.rows, widgets)) {
              finalSize = size;
              clamped = testClamped;
              foundFit = true;
              break;
            }
          }

          if (!foundFit) return;
        }

        dispatch({
          type: "ADD_WIDGET",
          payload: {
            id: uuidv4(),
            type: widgetType,
            col: clamped.col,
            row: clamped.row,
            cols: finalSize.cols,
            rows: finalSize.rows,
          },
        });
      } else {
        const widget = widgets.find((w) => w.id === data.widgetId);
        if (!widget) return;

        const deltaCol = Math.round(delta.x / cellSize.w);
        const deltaRow = Math.round(delta.y / cellSize.h);
        const newCol = widget.col + deltaCol;
        const newRow = widget.row + deltaRow;
        const clamped = clampToGrid(newCol, newRow, widget.cols, widget.rows);

        if (
          hasCollision(
            clamped.col,
            clamped.row,
            widget.cols,
            widget.rows,
            widgets,
            widget.id
          )
        )
          return;

        dispatch({
          type: "MOVE_WIDGET",
          payload: { id: widget.id, col: clamped.col, row: clamped.row },
        });
      }
    },
    [cellSize, dispatch, widgets]
  );

  const typeColors: Record<WidgetType, string> = {
    gauge: "border-blue-400 bg-blue-900/60",
    number: "border-green-400 bg-green-900/60",
    bar: "border-yellow-400 bg-yellow-900/60",
    graph: "border-purple-400 bg-purple-900/60",
    indicator: "border-red-400 bg-red-900/60",
  };

  let previewWidget = null;
  if (activeType) {
    const size = defaultSize[activeType];
    previewWidget = (
      <div
        className={`flex cursor-grabbing items-center justify-center rounded border-2 text-xs font-semibold opacity-80 shadow-2xl ${
          typeColors[activeType]
        }`}
        style={{
          width: size.cols * cellSize.w,
          height: size.rows * cellSize.h,
        }}
      >
        <span className="capitalize">{activeType}</span>
      </div>
    );
  } else if (activeWidgetId) {
    const widget = widgets.find((w) => w.id === activeWidgetId);
    if (widget) {
      previewWidget = (
        <div
          className={`flex cursor-grabbing items-center justify-center rounded border-2 text-xs font-semibold opacity-80 shadow-2xl ${
            typeColors[widget.type]
          }`}
          style={{
            width: widget.cols * cellSize.w,
            height: widget.rows * cellSize.h,
          }}
        >
          <span className="capitalize">{widget.type}</span>
        </div>
      );
    }
  }

  return (
    <>
    <style>{`
      @keyframes pageFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes editorEnter {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `}</style>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col" style={{ animation: "editorEnter 0.4s ease" }}>
        <div className="relative flex h-14 flex-shrink-0 items-center justify-center border-b border-gray-700 bg-gray-900">
          <span className="absolute left-4 text-lg font-bold text-white">T.R.A.C.K.</span>
          <div ref={tabsRef} className="relative flex items-center gap-8 h-full">
            <button
              ref={displayBtnRef}
              onClick={() => setPage("display")}
              className={`pb-1 text-base font-semibold transition-colors duration-200 ${
                page === "display" ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Screen Editor
            </button>
            <button
              ref={telemetryBtnRef}
              onClick={() => setPage("telemetry")}
              className={`pb-1 text-base font-semibold transition-colors duration-200 ${
                page === "telemetry" ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Live Telemetry
            </button>
            <button
              ref={mapBtnRef}
              onClick={() => setPage("map")}
              className={`pb-1 text-base font-semibold transition-colors duration-200 ${
                page === "map" ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              GPS Mapping
            </button>
            <button
              ref={logsBtnRef}
              onClick={() => setPage("logs")}
              className={`pb-1 text-base font-semibold transition-colors duration-200 ${
                page === "logs" ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Log Terminal
            </button>
            <button
              ref={deviceBtnRef}
              onClick={() => setPage("device")}
              className={`pb-1 text-base font-semibold transition-colors duration-200 ${
                page === "device" ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Device
            </button>
            {indicator.ready && (
              <div
                className="absolute bottom-0 h-0.5 bg-blue-500"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  transition: "left 0.25s ease, width 0.25s ease",
                }}
              />
            )}
          </div>
          <div className="absolute right-4 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${deviceConnected ? "bg-green-400" : "bg-gray-600"}`} />
              <span className="text-xs text-gray-400">{deviceConnected ? "Pi online" : "Pi offline"}</span>
            </div>
            {AUTH_ENABLED && auth.currentUser && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setSettingsOpen((o) => !o); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:ring-2 hover:ring-gray-600"
                >
                  {auth.currentUser.photoURL ? (
                    <img
                      src={auth.currentUser.photoURL}
                      alt=""
                      className="h-7 w-7 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {(auth.currentUser.displayName || auth.currentUser.email || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
                {settingsOpen && (
                  <div className="anim-dropdown absolute right-0 top-full mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-50">
                    <div className="px-4 py-2.5">
                      <p className="truncate text-sm font-medium text-gray-200">
                        {auth.currentUser.displayName || auth.currentUser.email}
                      </p>
                      {auth.currentUser.displayName && auth.currentUser.email && (
                        <p className="truncate text-xs text-gray-500">{auth.currentUser.email}</p>
                      )}
                    </div>
                    <div className="border-t border-gray-700" />
                    <button
                      onClick={() => { onLogout(); setSettingsOpen(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 first:rounded-t-none last:rounded-b-lg"
                    >
                      <LogOut size={13} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div key={page} className="flex flex-1 overflow-hidden" style={{ animation: "pageFadeIn 0.25s ease" }}>
          {page === "display" ? (
            <>
              <Navbar />
              <div ref={containerRef} className="relative flex-1">
                <GridCanvas cellWidth={cellSize.w} cellHeight={cellSize.h} />
              </div>
              <ConfigPanel />
            </>
          ) : page === "telemetry" ? (
            <TelemetryPage />
          ) : page === "map" ? (
            <MapPage />
          ) : page === "device" ? (
            <DevicePage />
          ) : (
            <LogTerminalPage />
          )}
        </div>
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 300,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {previewWidget}
      </DragOverlay>

    </DndContext>
    </>
  );
}
