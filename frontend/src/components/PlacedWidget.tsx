import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import type { PlacedWidget as PlacedWidgetType } from "../types";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { useTelemetry } from "../state/TelemetryContext";

interface Props {
  widget: PlacedWidgetType;
  cellWidth: number;
  cellHeight: number;
}

const typeColors: Record<string, string> = {
  gauge: "border-blue-400 bg-blue-900/60",
  number: "border-green-400 bg-green-900/60",
  bar: "border-yellow-400 bg-yellow-900/60",
  graph: "border-purple-400 bg-purple-900/60",
  indicator: "border-red-400 bg-red-900/60",
};

function getSignalKey(widget: PlacedWidgetType): string | null {
  if (!widget.widgetCanId || !widget.widgetSignal) return null;
  const canId = Number.parseInt(widget.widgetCanId, 16);
  if (Number.isNaN(canId)) return null;
  return `${canId}:${widget.widgetSignal}`;
}

function getValueClass(widget: PlacedWidgetType, value: number | undefined): string {
  if (value === undefined) return "text-gray-300";
  if (widget.widgetCriticalThreshold !== undefined && value >= widget.widgetCriticalThreshold) {
    return "text-red-300";
  }
  if (widget.widgetCautionThreshold !== undefined && value >= widget.widgetCautionThreshold) {
    return "text-amber-200";
  }
  return "text-green-200";
}

function formatValue(value: number | undefined): string {
  if (value === undefined) return "---";
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export default function PlacedWidget({ widget, cellWidth, cellHeight }: Props) {
  const { selectedWidgetId } = useEditorState();
  const dispatch = useEditorDispatch();
  const { signals } = useTelemetry();
  const isSelected = selectedWidgetId === widget.id;
  const signalKey = getSignalKey(widget);
  const signalHistory = signalKey ? signals[signalKey] : undefined;
  const latestValue = signalHistory?.[signalHistory.length - 1];
  const valueClass = getValueClass(widget, latestValue);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: widget.id,
    data: { fromPalette: false, widgetId: widget.id },
  });

  const style: CSSProperties = {
    position: "absolute",
    left: widget.col * cellWidth,
    top: widget.row * cellHeight,
    width: widget.cols * cellWidth,
    height: widget.rows * cellHeight,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "SELECT_WIDGET", payload: { id: widget.id } });
      }}
      className={`flex cursor-grab flex-col items-center justify-center overflow-hidden rounded border-2 text-xs font-semibold select-none ${
        typeColors[widget.type] ?? "border-gray-400 bg-gray-800"
      } ${isSelected ? "ring-2 ring-white" : ""} ${!widget.widgetSignal ? "border-dashed opacity-60" : ""}`}
    >
      <div className="flex h-full w-full flex-col justify-between px-2 py-1">
        <span
          className="w-full truncate text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80"
          title={widget.widgetSignal ?? widget.type}
        >
          {widget.widgetSignal ?? widget.type}
        </span>
        <div className="flex flex-col items-center leading-none">
          <span className={`max-w-full truncate text-center font-mono text-lg font-bold tabular-nums ${valueClass}`}>
            {formatValue(latestValue)}
          </span>
          {widget.widgetUnit && (
            <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-white/60">
              {widget.widgetUnit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
