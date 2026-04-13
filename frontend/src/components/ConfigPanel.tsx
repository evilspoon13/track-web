import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { allowedSizes } from "../utils/widgetDefaults";
import { hasCollision } from "../utils/gridHelpers";
import CanIdConfigurator from "./CanIdConfigurator";
import AnimatedSelect from "./AnimatedSelect";
import type { GraphInfo, graphMode } from "../types";

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
      widgetUnit: string | undefined;
      widgetMin: number | undefined;
      widgetMax: number | undefined;
      widgetCautionThreshold: number | undefined;
      widgetCriticalThreshold: number | undefined;
      graphConfig: GraphInfo | undefined;
    }>
  ) => {
    if (!widget) return;
    dispatch({ type: "UPDATE_WIDGET_DATA", payload: { id: widget.id, ...updates } });
  };

  const handleGraphConfig = (updates: Partial<GraphInfo>) => {
    if (!widget) return;
    const current = widget.graphConfig ?? { mode: "time_series" as graphMode, max_points: 1000 };
    handleWidgetData({ graphConfig: { ...current, ...updates } });
  };

  const selectedFrameSignals = widget?.widgetCanId
    ? (frameParserConfig[widget.widgetCanId]?.signals ?? [])
    : [];

  const numberInputClass =
    "w-full rounded border border-gray-700 bg-transparent px-2 py-1.5 text-xs text-white focus:border-gray-500 focus:outline-none";

  return (
    <div className="flex w-80 flex-col overflow-hidden border-l border-gray-700 bg-gray-800">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
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
                <AnimatedSelect
                  value={widget.widgetCanId ?? ""}
                  onChange={(v) =>
                    handleWidgetData({
                      widgetCanId: v || undefined,
                      widgetSignal: undefined,
                    })
                  }
                  options={[
                    { value: "", label: "None" },
                    ...Object.entries(frameParserConfig).map(([id, frame]) => ({
                      value: id,
                      label: `${id} (${frame.can_id_label})`,
                    })),
                  ]}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Signal</label>
                <AnimatedSelect
                  value={widget.widgetSignal ?? ""}
                  onChange={(v) =>
                    handleWidgetData({ widgetSignal: v || undefined })
                  }
                  disabled={!widget.widgetCanId}
                  options={[
                    { value: "", label: "None" },
                    ...selectedFrameSignals.map((sig) => ({
                      value: sig.name,
                      label: sig.name,
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Unit + [Size + Alarm] on same row, Unit aligns with Min */}
            <div className="mb-3 grid grid-cols-2 items-start gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Unit</label>
                <input
                  type="text"
                  value={widget.widgetUnit ?? ""}
                  onChange={(e) =>
                    handleWidgetData({
                      widgetUnit: e.target.value || undefined,
                    })
                  }
                  placeholder="e.g. °C, psi, RPM"
                  className={numberInputClass}
                />
              </div>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <label className="mb-1 block text-xs text-gray-500">Size</label>
                  <AnimatedSelect
                    value={`${widget.cols}x${widget.rows}`}
                    onChange={(v) => {
                      const [c, r] = v.split("x").map(Number);
                      handleResize(c!, r!);
                    }}
                    options={sizes
                      .filter((s) => {
                        const isCurrent = s.cols === widget.cols && s.rows === widget.rows;
                        return isCurrent || !hasCollision(widget.col, widget.row, s.cols, s.rows, screen!.widgets, widget.id);
                      })
                      .map((s) => ({
                        value: `${s.cols}x${s.rows}`,
                        label: `${s.cols} \u00d7 ${s.rows}`,
                      }))}
                  />
                </div>
                <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
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

            {/* Graph Config — only shown for graph widgets */}
            {widget.type === "graph" && (
              <div className="mb-4">
                <h4 className="mb-2 border-b border-gray-700 pb-1 text-xs font-semibold text-gray-400">
                  Graph Settings
                </h4>

                {/* Mode */}
                <div className="mb-2">
                  <label className="mb-1 block text-xs text-gray-500">Mode</label>
                  <AnimatedSelect
                    value={widget.graphConfig?.mode ?? "time_series"}
                    onChange={(v) =>
                      handleGraphConfig({ mode: v as graphMode })
                    }
                    options={[
                      { value: "time_series", label: "Time Series" },
                      { value: "xy", label: "XY" },
                    ]}
                  />
                </div>

                {/* Max Points */}
                <div className="mb-2">
                  <label className="mb-1 block text-xs text-gray-500">Max Points</label>
                  <input
                    type="number"
                    value={widget.graphConfig?.max_points ?? 1000}
                    onChange={(e) =>
                      handleGraphConfig({ max_points: parseInt(e.target.value) || 1000 })
                    }
                    className={numberInputClass}
                  />
                </div>

                {/* Time Series: window */}
                {(widget.graphConfig?.mode ?? "time_series") === "time_series" && (
                  <div className="mb-2">
                    <label className="mb-1 block text-xs text-gray-500">Window (s)</label>
                    <input
                      type="number"
                      value={widget.graphConfig?.window_seconds ?? 30}
                      onChange={(e) =>
                        handleGraphConfig({ window_seconds: parseFloat(e.target.value) || 30 })
                      }
                      className={numberInputClass}
                    />
                  </div>
                )}

                {/* XY mode: X-axis settings */}
                {widget.graphConfig?.mode === "xy" && (
                  <>
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">X Frame</label>
                        <AnimatedSelect
                          value={widget.graphConfig?.x_can_id ?? ""}
                          onChange={(v) =>
                            handleGraphConfig({
                              x_can_id: v || undefined,
                            })
                          }
                          options={[
                            { value: "", label: "None" },
                            ...Object.entries(frameParserConfig).map(([id, frame]) => ({
                              value: id,
                              label: `${id} (${frame.can_id_label})`,
                            })),
                          ]}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">X Signal</label>
                        <AnimatedSelect
                          value={widget.graphConfig?.x_signal ?? ""}
                          onChange={(v) =>
                            handleGraphConfig({ x_signal: v || undefined })
                          }
                          disabled={widget.graphConfig?.x_can_id === undefined}
                          options={[
                            { value: "", label: "None" },
                            ...(widget.graphConfig?.x_can_id !== undefined
                              ? frameParserConfig[widget.graphConfig.x_can_id]?.signals ?? []
                              : []
                            ).map((sig) => ({
                              value: sig.name,
                              label: sig.name,
                            })),
                          ]}
                        />
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="mb-1 block text-xs text-gray-500">X Unit</label>
                      <input
                        type="text"
                        value={widget.graphConfig?.x_unit ?? ""}
                        onChange={(e) =>
                          handleGraphConfig({ x_unit: e.target.value || undefined })
                        }
                        placeholder="e.g. rpm"
                        className={numberInputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">X Min</label>
                        <input
                          type="number"
                          value={widget.graphConfig?.x_min ?? ""}
                          onChange={(e) =>
                            handleGraphConfig({ x_min: e.target.value ? parseFloat(e.target.value) : undefined })
                          }
                          placeholder="—"
                          className={numberInputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">X Max</label>
                        <input
                          type="number"
                          value={widget.graphConfig?.x_max ?? ""}
                          onChange={(e) =>
                            handleGraphConfig({ x_max: e.target.value ? parseFloat(e.target.value) : undefined })
                          }
                          placeholder="—"
                          className={numberInputClass}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </>
          )}
        </div>
      </div>

      {/* Delete Widget pinned at bottom */}
      {widget && (
        <div className="border-t border-gray-700 px-4 py-3">
          <button
            onClick={() =>
              dispatch({ type: "REMOVE_WIDGET", payload: { id: widget.id } })
            }
            className="w-full rounded border border-red-900 py-1.5 text-xs text-red-400 hover:border-red-700 hover:text-red-300"
          >
            Delete Widget
          </button>
        </div>
      )}
    </div>
  );
}
