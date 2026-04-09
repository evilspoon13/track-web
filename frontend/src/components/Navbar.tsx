import { useState } from "react";
import DraggableWidget from "./DraggableWidget";
import ScreenTabs from "./ScreenTabs";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { saveScreen, deleteScreen, uploadDbc, saveDbc } from "../utils/layoutIO";
import type { WidgetType } from "../types";
import { Save, RotateCcw, X, Upload } from "lucide-react";

const widgetTypes: WidgetType[] = [
  "gauge",
  "number",
  "bar",
  "graph",
  "indicator",
];

export default function Navbar() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dbcStatus, setDbcStatus] = useState<string>("");

  const activeScreen = state.screens.find((s) => s.id === state.activeScreenId);

  const executeSave = async () => {
    if (!activeScreen) return;
    await saveScreen(
      { name: activeScreen.name, widgets: activeScreen.widgets },
      state.frameParserConfig
    );
    dispatch({
      type: "UPDATE_ORIGINAL_NAME",
      payload: { id: activeScreen.id, originalName: activeScreen.name },
    });
    dispatch({ type: "MARK_CLEAN", payload: { id: activeScreen.id } });
    if (state.canIdsDirty) {
      await saveDbc(state.frameParserConfig);
      dispatch({ type: "MARK_CAN_IDS_CLEAN" });
    }
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleSave = () => {
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    setShowSaveModal(false);
    executeSave();
  };

  const handleConfirmClear = () => {
    setShowClearModal(false);
    dispatch({ type: "CLEAR_SCREEN" });
  };

  const handleConfirmDelete = async () => {
    if (!activeScreen) return;
    setShowDeleteModal(false);
    if (activeScreen.originalName) {
      await deleteScreen(activeScreen.originalName);
    }
    dispatch({ type: "REMOVE_SCREEN", payload: { id: activeScreen.id } });
  };

  const handleDbcUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".dbc")) {
      setDbcStatus("Error: must be a .dbc file");
      e.target.value = "";
      return;
    }
    const content = await file.text();
    const result = await uploadDbc(content);
    if ("error" in result) {
      setDbcStatus(`Error: ${result.error}`);
      e.target.value = "";
      return;
    }
    dispatch({ type: "SET_FRAME_PARSER_CONFIG", payload: { config: result } });
    dispatch({ type: "MARK_CAN_IDS_CLEAN" });
    setDbcStatus(file.name);
    e.target.value = "";
  };

  const saveModalMessage = state.canIdsDirty
    ? "This will save the current screen configuration and CAN ID definitions."
    : "This will save the current screen configuration.";

  return (
    <>
      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="anim-modal mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Save Configuration?</h2>
            <p className="mb-8 text-gray-300">{saveModalMessage}</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 rounded bg-gray-700 px-6 py-4 text-lg font-medium text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 rounded bg-orange-600 px-6 py-4 text-lg font-medium text-white hover:bg-orange-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Widgets Confirmation Modal */}
      {showClearModal && (
        <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="anim-modal mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Clear Widgets?</h2>
            <p className="mb-8 text-gray-300">
              This will remove all widgets from the current screen.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 rounded bg-gray-700 px-6 py-4 text-lg font-medium text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="flex-1 rounded bg-orange-600 px-6 py-4 text-lg font-medium text-white hover:bg-orange-500"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Screen Confirmation Modal */}
      {showDeleteModal && (
        <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="anim-modal mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Delete Screen?</h2>
            <p className="mb-8 text-gray-300">
              This will permanently delete the current screen and all its widgets.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded bg-gray-700 px-6 py-4 text-lg font-medium text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 rounded bg-red-600 px-6 py-4 text-lg font-medium text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-full w-72 flex-col border-r border-gray-700 bg-gray-800">
        {/* Header */}
        {/* DBC Upload */}
        <div className="border-b border-gray-700 p-4">
          <label className="mb-2 block text-xs font-medium text-gray-400">DBC File</label>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-gray-400 hover:border-gray-500 hover:text-white">
            <Upload className="h-3.5 w-3.5" />
            {dbcStatus ? dbcStatus : "Upload .dbc"}
            <input type="file" accept=".dbc" className="hidden" onChange={handleDbcUpload} />
          </label>
        </div>

        {/* Screen Tabs */}
        <div
          className="overflow-y-auto border-b border-gray-700 p-4 scrollbar-hide"
          style={{ maxHeight: "200px" }}
        >
          <label className="mb-2 block text-xs font-medium text-gray-400">
            Screens
          </label>
          <div className="flex flex-col gap-2">
            <ScreenTabs />
          </div>
        </div>

        {/* Widget Palette */}
        <div className="border-b border-gray-700 p-4">
          <label className="mb-2 block text-xs font-medium text-gray-400">
            Components
          </label>
          <div
            className="grid grid-cols-2 gap-2 overflow-y-auto scrollbar-hide"
            style={{ maxHeight: "400px" }}
          >
            {widgetTypes.map((t) => (
              <DraggableWidget key={t} widgetType={t} />
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="p-4">
          <div className="flex gap-2">
            {/* Save */}
            <button
              onClick={handleSave}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded py-3 transition-colors duration-200 ${
                activeScreen?.isDirty || state.canIdsDirty
                  ? "bg-gray-700 hover:bg-orange-700"
                  : "bg-gray-700 hover:bg-blue-700"
              }`}
              aria-label="Save configuration"
            >
              <Save className="h-5 w-5 text-white" />
              <span className="text-xs text-white">
                {saveStatus || "Save"}
              </span>
              {(activeScreen?.isDirty || state.canIdsDirty) && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500" />
              )}
            </button>

            {/* Clear */}
            <button
              onClick={() => setShowClearModal(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded bg-gray-700 py-3 transition-colors duration-200 hover:bg-amber-700"
              aria-label="Clear all widgets"
            >
              <RotateCcw className="h-5 w-5 text-white" />
              <span className="text-xs text-white">Clear</span>
            </button>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={state.screens.length <= 1}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded py-3 transition-colors duration-200 ${
                state.screens.length <= 1
                  ? "cursor-not-allowed bg-gray-700 opacity-40"
                  : "bg-gray-700 hover:bg-red-800"
              }`}
              aria-label="Delete current screen"
            >
              <X className="h-5 w-5 text-white" />
              <span className="text-xs text-white">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
