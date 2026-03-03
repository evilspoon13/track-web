import { useDroppable } from "@dnd-kit/core";
import { useRef } from "react";
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
    <div className="flex h-full w-full items-center justify-center p-4">
      <div
        ref={(node) => {
          setNodeRef(node);
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        style={{ width: totalWidth, height: totalHeight }}
        className="relative rounded border border-gray-600 bg-gray-950"
        onClick={() =>
          dispatch({ type: "SELECT_WIDGET", payload: { id: null } })
        }
      >
        {gridLines}
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
