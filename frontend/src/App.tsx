import { useState, useCallback, useRef, useEffect } from "react";
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { v4 as uuidv4 } from "uuid";
import { EditorProvider, useEditorState, useEditorDispatch } from "./state/EditorContext";
import Navbar from "./components/Navbar";
import GridCanvas from "./components/GridCanvas";
import ConfigPanel from "./components/ConfigPanel";
import { defaultSize, allowedSizes } from "./utils/widgetDefaults";
import { pixelToGrid, hasCollision, clampToGrid } from "./utils/gridHelpers";
import { GRID_COLS, GRID_ROWS } from "./utils/widgetDefaults";
import type { WidgetType } from "./types";

const ASPECT_RATIO = GRID_COLS / GRID_ROWS;

function EditorLayout() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState({ w: 80, h: 80 });
  const [activeType, setActiveType] = useState<WidgetType | null>(null);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

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

        const dropX = activeRect.left - overRect.left + activeRect.width / 2;
        const dropY = activeRect.top - overRect.top + activeRect.height / 2;

        const { col, row } = pixelToGrid(dropX, dropY, cellSize.w, cellSize.h);
        const widgetType = data.widgetType;

        // Try default size first
        const defaultWidgetSize = defaultSize[widgetType];
        let finalSize = defaultWidgetSize;
        let clamped = clampToGrid(col, row, defaultWidgetSize.cols, defaultWidgetSize.rows);

        // If default size doesn't fit, try other allowed sizes
        if (hasCollision(clamped.col, clamped.row, defaultWidgetSize.cols, defaultWidgetSize.rows, widgets)) {
          const sizes = allowedSizes[widgetType];
          let foundFit = false;

          for (const size of sizes) {
            // Skip default size since we already tried it
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

          // If no size fits, bail out
          if (!foundFit) return;
        }

        dispatch({
          type: "ADD_WIDGET",
          payload: {
            id: uuidv4(),
            type: widgetType,
            label: "",
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

  // Get preview widget for drag overlay
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
          {widget.label && (
            <span className="mt-0.5 text-[10px] font-normal text-gray-300">
              {widget.label}
            </span>
          )}
        </div>
      );
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <div ref={containerRef} className="flex-1">
            <GridCanvas cellWidth={cellSize.w} cellHeight={cellSize.h} />
          </div>
          <ConfigPanel />
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
  );
}

export default function App() {
  return (
    <EditorProvider>
      <EditorLayout />
    </EditorProvider>
  );
}
