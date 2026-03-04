import { useState, useEffect } from "react";
import DraggableWidget from "./DraggableWidget";
import ScreenTabs from "./ScreenTabs";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { listScreens, loadScreen, saveScreen, deleteScreen } from "../utils/layoutIO";
import type { WidgetType } from "../types";
import { Save, RotateCcw, X } from "lucide-react";

const widgetTypes: WidgetType[] = [
  "gauge",
  "number",
  "bar",
  "graph",
  "indicator",
];

const SELECT_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
  backgroundPosition: "right 0.5rem center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "1.5em 1.5em",
};

export default function Navbar() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [availableScreens, setAvailableScreens] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDriverDisplayModal, setShowDriverDisplayModal] = useState(false);
  const [pendingDriverDisplay, setPendingDriverDisplay] = useState<string | null>(null);

  const activeScreen = state.screens.find((s) => s.id === state.activeScreenId);

  const refreshScreens = async () => {
    setAvailableScreens(await listScreens());
  };

  useEffect(() => {
    refreshScreens();
  }, []);

  // Refresh dropdown when screen names change
  useEffect(() => {
    refreshScreens();
  }, [state.screens.map((s) => s.name).join(",")]);

  const handleLoad = async (name: string) => {
    const existing = state.screens.find((s) => s.name === name);
    if (existing) {
      dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: existing.id } });
      return;
    }
    const screen = await loadScreen(name);
    if (!screen) return;
    dispatch({ type: "LOAD_SCREEN", payload: screen });
  };

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
    if (state.driverDisplayDirty) {
      dispatch({ type: "MARK_DRIVER_DISPLAY_CLEAN" });
    }
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
    refreshScreens();
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
      refreshScreens();
    }
    dispatch({ type: "REMOVE_SCREEN", payload: { id: activeScreen.id } });
  };

  const handleDriverDisplayChange = (value: string) => {
    setPendingDriverDisplay(value || null);
    setShowDriverDisplayModal(true);
  };

  const handleConfirmDriverDisplay = () => {
    setShowDriverDisplayModal(false);
    dispatch({ type: "SET_DRIVER_DISPLAY", payload: { screenName: pendingDriverDisplay } });
  };

  const saveModalMessage = state.driverDisplayDirty && state.driverDisplayScreen
    ? `This will save all screen configurations and update the Driver Display to "${state.driverDisplayScreen}".`
    : "This will save the current screen configuration.";

  return (
    <>
      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
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

      {/* Driver Display Confirmation Modal */}
      {showDriverDisplayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Change Driver Display?</h2>
            <p className="mb-8 text-gray-300">
              Are you sure? Changing the driver display will update what the driver sees. This will take effect when you save.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDriverDisplayModal(false)}
                className="flex-1 rounded bg-gray-700 px-6 py-4 text-lg font-medium text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDriverDisplay}
                className="flex-1 rounded bg-orange-600 px-6 py-4 text-lg font-medium text-white hover:bg-orange-500"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-screen w-72 flex-col border-r border-gray-700 bg-gray-800">
        {/* Header */}
        <div className="border-b border-gray-700 p-4">
          <h1 className="text-lg font-bold text-white">T.R.A.C.K.</h1>
          <p className="text-xs text-gray-400">Configurator</p>
        </div>

        {/* Load Screen Dropdown */}
        <div className="border-b border-gray-700 p-4">
          <label className="mb-2 block text-xs font-medium text-gray-400">
            Load Screen
          </label>
          <select
            value=""
            onChange={(e) => e.target.value && handleLoad(e.target.value)}
            className="w-full appearance-none rounded border border-gray-600 bg-gray-900 px-3 py-2 pr-8 text-sm text-white focus:border-blue-500 focus:outline-none"
            style={SELECT_STYLE}
          >
            <option value="">Select saved screen...</option>
            {availableScreens.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
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

        {/* Driver Display Selector */}
        <div className="border-t border-gray-700 px-4 pt-4">
          <label className="mb-2 block text-xs font-medium text-gray-400">
            Driver Display
            {state.driverDisplayDirty && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-orange-500 align-middle" />
            )}
          </label>
          <select
            value={state.driverDisplayScreen ?? ""}
            onChange={(e) => handleDriverDisplayChange(e.target.value)}
            className="w-full appearance-none rounded border border-gray-600 bg-gray-900 px-3 py-2 pr-8 text-sm text-white focus:border-blue-500 focus:outline-none"
            style={SELECT_STYLE}
          >
            <option value="">None</option>
            {state.screens.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="p-4">
          <div className="flex gap-2">
            {/* Save */}
            <button
              onClick={handleSave}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded py-3 transition-colors duration-200 ${
                activeScreen?.isDirty || state.driverDisplayDirty
                  ? "bg-gray-700 hover:bg-orange-700"
                  : "bg-gray-700 hover:bg-blue-700"
              }`}
              aria-label="Save configuration"
            >
              <Save className="h-5 w-5 text-white" />
              <span className="text-xs text-white">
                {saveStatus || "Save"}
              </span>
              {(activeScreen?.isDirty || state.driverDisplayDirty) && (
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
