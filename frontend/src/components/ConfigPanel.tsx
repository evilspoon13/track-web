import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { allowedSizes } from "../utils/widgetDefaults";
import { hasCollision } from "../utils/gridHelpers";

const MAX_WIDGET_LABEL_LENGTH = 30;

export default function ConfigPanel() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  const screen = state.screens.find((s) => s.id === state.activeScreenId);
  const widget = screen?.widgets.find((w) => w.id === state.selectedWidgetId);
  const { dbcFile } = state;

  if (!screen || !state.selectedWidgetId || !widget) {
    return (
      <div className="flex w-56 flex-col border-l border-gray-700 bg-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-400">Widget Settings</h3>
        <p className="mt-4 text-xs text-gray-500">
          Click a widget to configure
        </p>
      </div>
    );
  }

  const sizes = allowedSizes[widget.type];

  const handleResize = (cols: number, rows: number) => {
    if (
      hasCollision(
        widget.col,
        widget.row,
        cols,
        rows,
        screen.widgets,
        widget.id
      )
    )
      return;
    dispatch({
      type: "RESIZE_WIDGET",
      payload: { id: widget.id, cols, rows },
    });
  };

  const handleCanIdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (value === "custom") {
      dispatch({
        type: "UPDATE_WIDGET_CAN",
        payload: { id: widget.id, canId: "", canIdSource: "custom" },
      });
    } else if (value === "") {
      dispatch({
        type: "UPDATE_WIDGET_CAN",
        payload: { id: widget.id, canId: "", canIdSource: "dbc" },
      });
    } else {
      dispatch({
        type: "UPDATE_WIDGET_CAN",
        payload: { id: widget.id, canId: value, canIdSource: "dbc" },
      });
    }
  };

  const handleCustomCanIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: "UPDATE_WIDGET_CAN",
      payload: {
        id: widget.id,
        canId: e.target.value,
        canIdSource: "custom",
      },
    });
  };

  return (
    <div className="flex w-56 flex-col gap-4 border-l border-gray-700 bg-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-300">Widget Settings</h3>

      <div>
        <label className="mb-1 block text-xs text-gray-400">Type</label>
        <span className="text-sm capitalize text-white">{widget.type}</span>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-400">
          Label
          <span className="ml-1 text-[10px] text-gray-500">
            ({widget.label.length}/{MAX_WIDGET_LABEL_LENGTH})
          </span>
        </label>
        <input
          type="text"
          value={widget.label}
          maxLength={MAX_WIDGET_LABEL_LENGTH}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_WIDGET_LABEL",
              payload: { id: widget.id, label: e.target.value },
            })
          }
          placeholder="Enter label..."
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* CAN ID Selection */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">
          CAN Signal
        </label>

        <select
          value={widget.canIdSource === "custom" ? "custom" : (widget.canId || "")}
          onChange={handleCanIdChange}
          className="w-full appearance-none rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: "right 0.5rem center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "1.5em 1.5em",
            paddingRight: "2.5rem",
          }}
        >
          <option value="">No signal assigned</option>

          {dbcFile && (
            <optgroup label="DBC Signals">
              {dbcFile.signals.map((sig) => (
                <option key={sig.id} value={sig.id}>
                  {sig.name} {sig.unit ? `(${sig.unit})` : ""}
                </option>
              ))}
            </optgroup>
          )}

          <option value="custom">Custom CAN ID...</option>
        </select>

        {/* Show custom text input if "Custom" selected */}
        {widget.canIdSource === "custom" && (
          <input
            type="text"
            placeholder="Enter custom CAN ID"
            value={widget.canId || ""}
            onChange={handleCustomCanIdChange}
            className="mt-2 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-400">Size</label>
        <div className="grid grid-cols-2 gap-2">
          {sizes.map((s) => {
            const isActive = s.cols === widget.cols && s.rows === widget.rows;
            const canResize = !hasCollision(
              widget.col,
              widget.row,
              s.cols,
              s.rows,
              screen.widgets,
              widget.id
            );

            return (
              <button
                key={`${s.cols}x${s.rows}`}
                onClick={() => canResize && handleResize(s.cols, s.rows)}
                disabled={!canResize}
                className={`rounded px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : canResize
                    ? "border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "border border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed"
                }`}
              >
                {s.cols} × {s.rows}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() =>
          dispatch({ type: "REMOVE_WIDGET", payload: { id: widget.id } })
        }
        className="mt-auto rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-600"
      >
        Delete Widget
      </button>
    </div>
  );
}
