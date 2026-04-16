import { useDroppable } from "@dnd-kit/core";
import { useRef, useEffect } from "react";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { GRID_COLS, GRID_ROWS } from "../utils/widgetDefaults";
import PlacedWidget from "./PlacedWidget";

interface Props {
  cellWidth: number;
  cellHeight: number;
}

export default function GridCanvas({ cellWidth, cellHeight }: Props) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const containerRef = useRef<HTMLDivElement>(null);

  const screen = state.screens.find((s) => s.id === state.activeScreenId);
  const widgets = screen?.widgets ?? [];

  const { setNodeRef } = useDroppable({ id: "grid-canvas" });

  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null);

  useEffect(() => {
    const el = swipeAreaRef.current;
    if (!el) return;

    const onTouchStart = (e: globalThis.TouchEvent) => {
      if (e.touches.length !== 1) return;
      swipeRef.current = { startX: e.touches[0]!.clientX, startY: e.touches[0]!.clientY };
    };

    const onTouchMove = (e: globalThis.TouchEvent) => {
      e.preventDefault();
    };

    const onTouchEnd = (e: globalThis.TouchEvent) => {
      if (!swipeRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) { swipeRef.current = null; return; }
      const dx = touch.clientX - swipeRef.current.startX;
      const dy = touch.clientY - swipeRef.current.startY;
      swipeRef.current = null;

      if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;

      const idx = state.screens.findIndex((s) => s.id === state.activeScreenId);
      if (idx < 0) return;

      if (dx < 0 && idx < state.screens.length - 1) {
        dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: state.screens[idx + 1]!.id } });
      } else if (dx > 0 && idx > 0) {
        dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: state.screens[idx - 1]!.id } });
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [state.screens, state.activeScreenId, dispatch]);

  const totalWidth = GRID_COLS * cellWidth;
  const totalHeight = GRID_ROWS * cellHeight;

  const gridLines: React.ReactNode[] = [];
  for (let c = 0; c <= GRID_COLS; c++) {
    gridLines.push(
      <div
        key={`vc-${c}`}
        className="pointer-events-none absolute top-0 bottom-0 border-l border-gray-700"
        style={{ left: c * cellWidth }}
      />
    );
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    gridLines.push(
      <div
        key={`hr-${r}`}
        className="pointer-events-none absolute right-0 left-0 border-t border-gray-700"
        style={{ top: r * cellHeight }}
      />
    );
  }

  return (
    <div ref={swipeAreaRef} className="flex h-full w-full items-center justify-center p-4">
      <div
        ref={(node) => {
          setNodeRef(node);
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        style={{ width: totalWidth, height: totalHeight }}
        className="relative rounded border border-gray-600 bg-gray-950 touch-none"
        onClick={() =>
          dispatch({ type: "SELECT_WIDGET", payload: { id: null } })
        }
      >
        {gridLines}
        {widgets.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-600">Drag a widget onto the canvas</p>
          </div>
        )}
        {widgets.map((w) => (
          <PlacedWidget
            key={w.id}
            widget={w}
            cellWidth={cellWidth}
            cellHeight={cellHeight}
          />
        ))}
      </div>
    </div>
  );
}
