import { useDraggable } from "@dnd-kit/core";
import type { PlacedWidget as PlacedWidgetType } from "../types";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";

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

export default function PlacedWidget({ widget, cellWidth, cellHeight }: Props) {
  const { selectedWidgetId } = useEditorState();
  const dispatch = useEditorDispatch();
  const isSelected = selectedWidgetId === widget.id;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: widget.id,
    data: { fromPalette: false, widgetId: widget.id },
  });

  const style: React.CSSProperties = {
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
      className={`flex cursor-grab flex-col items-center justify-center rounded border-2 text-xs font-semibold select-none ${
        typeColors[widget.type] ?? "border-gray-400 bg-gray-800"
      } ${isSelected ? "ring-2 ring-white" : ""}`}
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
