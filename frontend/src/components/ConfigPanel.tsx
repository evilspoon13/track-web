import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { allowedSizes } from "../utils/widgetDefaults";
import { hasCollision } from "../utils/gridHelpers";
import CanIdConfigurator from "./CanIdConfigurator";
import type { DataFieldType } from "../types";

const DATA_FIELD_TYPES: DataFieldType[] = ["temperature", "pressure", "rpm"];

const SELECT_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: "right 0.5rem center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "1.5em 1.5em",
  paddingRight: "2.5rem",
};

export default function ConfigPanel() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  const screen = state.screens.find((s) => s.id === state.activeScreenId);
  const widget = screen?.widgets.find((w) => w.id === state.selectedWidgetId);
  const { frameParserConfig } = state;

  const sizes = widget ? allowedSizes[widget.type] : [];

  const handleResize = (cols: number, rows: number) => {
    if (!widget || !screen) return;
    if (hasCollision(widget.col, widget.row, cols, rows, screen.widgets, widget.id)) return;
    dispatch({ type: "RESIZE_WIDGET", payload: { id: widget.id, cols, rows } });
  };

  const handleWidgetData = (
    updates: Partial<{
      alarm: boolean;
      widgetCanId: string | undefined;
      widgetSignal: string | undefined;
      widgetUnit: DataFieldType | undefined;
      widgetMin: number | undefined;
      widgetMax: number | undefined;
      widgetCautionThreshold: number | undefined;
      widgetCriticalThreshold: number | undefined;
    }>
  ) => {
    if (!widget) return;
    dispatch({ type: "UPDATE_WIDGET_DATA", payload: { id: widget.id, ...updates } });
  };

  const selectedFrameSignals = widget?.widgetCanId
    ? (frameParserConfig[widget.widgetCanId]?.signals ?? [])
    : [];

  const selectClass =
    "w-full appearance-none rounded border border-gray-700 bg-transparent px-2 py-1.5 text-xs text-white focus:border-gray-500 focus:outline-none";

  const numberInputClass =
    "w-full rounded border border-gray-700 bg-transparent px-2 py-1.5 text-xs text-white focus:border-gray-500 focus:outline-none";

  return (
    <div className="flex w-80 flex-col overflow-y-auto border-l border-gray-700 bg-gray-800 scrollbar-hide">
      {/* CAN ID Configurator */}
      <div className="border-b border-gray-600">
        <CanIdConfigurator />
      </div>

      {/* Widget Settings */}
      <div className="flex flex-col px-4 py-3">
        <h3 className="mb-3 border-b border-gray-700 pb-2 text-sm font-semibold text-gray-200">
          Widget Settings
        </h3>

        {!widget ? (
          <p className="text-xs text-gray-500">Click a widget to configure</p>
        ) : (
          <>
            {/* CAN Frame + Signal side by side */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Frame</label>
                <select
                  value={widget.widgetCanId ?? ""}
                  onChange={(e) =>
                    handleWidgetData({
                      widgetCanId: e.target.value || undefined,
                      widgetSignal: undefined,
                    })
                  }
                  className={selectClass}
                  style={SELECT_STYLE}
                >
                  <option value="" className="bg-gray-900">None</option>
                  {Object.entries(frameParserConfig).map(([id, frame]) => (
                    <option key={id} value={id} className="bg-gray-900">
                      {id} ({frame.can_id_label})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Signal</label>
                <select
                  value={widget.widgetSignal ?? ""}
                  onChange={(e) =>
                    handleWidgetData({ widgetSignal: e.target.value || undefined })
                  }
                  disabled={!widget.widgetCanId}
                  className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-40`}
                  style={SELECT_STYLE}
                >
                  <option value="" className="bg-gray-900">None</option>
                  {selectedFrameSignals.map((sig) => (
                    <option key={sig.name} value={sig.name} className="bg-gray-900">
                      {sig.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Unit + Alarm on same row */}
            <div className="mb-3 flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">Unit</label>
                <select
                  value={widget.widgetUnit ?? ""}
                  onChange={(e) =>
                    handleWidgetData({
                      widgetUnit: (e.target.value as DataFieldType) || undefined,
                    })
                  }
                  className={selectClass}
                  style={SELECT_STYLE}
                >
                  <option value="" className="bg-gray-900">None</option>
                  {DATA_FIELD_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-gray-900">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-1.5 flex flex-shrink-0 items-center gap-2">
                <span className="text-xs text-gray-500">Alarm</span>
                <button
                  role="switch"
                  aria-checked={widget.alarm ?? false}
                  onClick={() => handleWidgetData({ alarm: !(widget.alarm ?? false) })}
                  className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                    widget.alarm ? "bg-orange-500" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                      widget.alarm ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Min / Max */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Min</label>
                <input
                  type="number"
                  value={widget.widgetMin ?? ""}
                  onChange={(e) =>
                    handleWidgetData({
                      widgetMin: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="—"
                  className={numberInputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Max</label>
                <input
                  type="number"
                  value={widget.widgetMax ?? ""}
                  onChange={(e) =>
                    handleWidgetData({
                      widgetMax: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="—"
                  className={numberInputClass}
                />
              </div>
            </div>

            {/* Caution / Critical */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Caution</label>
                <input
                  type="number"
                  value={widget.widgetCautionThreshold ?? ""}
                  onChange={(e) =>
                    handleWidgetData({
                      widgetCautionThreshold: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="—"
                  className={numberInputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Critical</label>
                <input
                  type="number"
                  value={widget.widgetCriticalThreshold ?? ""}
                  onChange={(e) =>
                    handleWidgetData({
                      widgetCriticalThreshold: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="—"
                  className={numberInputClass}
                />
              </div>
            </div>

            {/* Size */}
            <div className="mb-4">
              <label className="mb-1 block text-xs text-gray-500">Size</label>
              <div className="grid grid-cols-2 gap-2">
                {sizes.map((s) => {
                  const isActive = s.cols === widget.cols && s.rows === widget.rows;
                  const canResize = !hasCollision(
                    widget.col,
                    widget.row,
                    s.cols,
                    s.rows,
                    screen!.widgets,
                    widget.id
                  );
                  return (
                    <button
                      key={`${s.cols}x${s.rows}`}
                      onClick={() => canResize && handleResize(s.cols, s.rows)}
                      disabled={!canResize}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : canResize
                          ? "border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
                          : "cursor-not-allowed border border-gray-800 text-gray-600"
                      }`}
                    >
                      {s.cols} × {s.rows}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delete Widget */}
            <button
              onClick={() =>
                dispatch({ type: "REMOVE_WIDGET", payload: { id: widget.id } })
              }
              className="mt-auto rounded border border-red-900 py-1.5 text-xs text-red-400 hover:border-red-700 hover:text-red-300"
            >
              Delete Widget
            </button>
          </>
        )}
      </div>
    </div>
  );
}
