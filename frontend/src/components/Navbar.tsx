import { useState, useEffect, useRef } from "react";
import DraggableWidget from "./DraggableWidget";
import ScreenTabs from "./ScreenTabs";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { listScreens, loadScreen, saveScreen, deleteScreen } from "../utils/layoutIO";
import type { WidgetType, DbcFile } from "../types";
import { Save, Check, FileEdit, X } from "lucide-react";

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
  const [availableScreens, setAvailableScreens] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const dbcInputRef = useRef<HTMLInputElement>(null);

  const activeScreen = state.screens.find((s) => s.id === state.activeScreenId);
  const { dbcFile } = state;

  const refreshScreens = () => {
    setAvailableScreens(listScreens());
  };

  useEffect(() => {
    refreshScreens();
  }, []);

  // Refresh dropdown when screen names change
  useEffect(() => {
    refreshScreens();
  }, [state.screens.map((s) => s.name).join(",")]);

  const handleLoad = (name: string) => {
    // Check if screen with this name is already open
    const existing = state.screens.find((s) => s.name === name);
    if (existing) {
      dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: existing.id } });
      return;
    }

    // Load from storage
    const screen = loadScreen(name);
    if (!screen) return;
    dispatch({ type: "LOAD_SCREEN", payload: screen });
  };

  const handleSave = () => {
    if (!activeScreen) return;

    saveScreen({
      name: activeScreen.name,
      widgets: activeScreen.widgets,
    });

    // Update originalName to current name after save
    dispatch({
      type: "UPDATE_ORIGINAL_NAME",
      payload: { id: activeScreen.id, originalName: activeScreen.name },
    });

    // Mark screen as clean
    dispatch({
      type: "MARK_CLEAN",
      payload: { id: activeScreen.id },
    });

    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
    refreshScreens();
  };

  const handleClearWidgets = () => {
    setShowClearModal(true);
  };

  const handleConfirmClear = () => {
    setShowClearModal(false);
    dispatch({ type: "CLEAR_SCREEN" });
  };

  const handleDeleteScreen = () => {
    if (!activeScreen) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!activeScreen) return;
    setShowDeleteModal(false);

    // Delete from localStorage if it was saved
    if (activeScreen.originalName) {
      deleteScreen(activeScreen.originalName);
      refreshScreens();
    }

    dispatch({ type: "REMOVE_SCREEN", payload: { id: activeScreen.id } });
  };

  const handleCommit = () => {
    setShowCommitModal(true);
  };

  const handleConfirmCommit = () => {
    setShowCommitModal(false);
    // TODO: Backend integration - export to graphics engine config
    setSaveStatus("Committed!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleDbcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: When backend ready, send file to POST /api/dbc/upload
    // For now, use hardcoded sample data
    const sampleDbcFile: DbcFile = {
      filename: file.name,
      signals: [
        { id: "ENGINE_RPM", name: "Engine RPM", unit: "rpm" },
        { id: "WHEEL_SPEED_FL", name: "Wheel Speed (Front Left)", unit: "km/h" },
        { id: "BATTERY_VOLTAGE", name: "Battery Voltage", unit: "V" },
        { id: "MOTOR_TEMP", name: "Motor Temperature", unit: "°C" },
        { id: "THROTTLE_POS", name: "Throttle Position", unit: "%" },
      ],
      uploadedAt: new Date().toISOString(),
    };

    dispatch({ type: "LOAD_DBC", payload: sampleDbcFile });

    // Reset input for re-upload
    e.target.value = "";
  };

  const handleClearDbc = () => {
    dispatch({ type: "CLEAR_DBC" });
  };

  return (
    <>
      {/* Clear Widgets Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">
              Clear Widgets?
            </h2>
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
            <h2 className="mb-4 text-xl font-bold text-white">
              Delete Screen?
            </h2>
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

      {/* Commit Confirmation Modal */}
      {showCommitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">
              Commit Configuration?
            </h2>
            <p className="mb-8 text-gray-300">
              This will update the driver display configuration.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCommitModal(false)}
                className="flex-1 rounded bg-gray-700 px-6 py-4 text-lg font-medium text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCommit}
                className="flex-1 rounded bg-green-600 px-6 py-4 text-lg font-medium text-white hover:bg-green-500"
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

      {/* DBC Upload Section */}
      <div className="border-b border-gray-700 p-4">
        <label className="text-xs text-gray-400 mb-2 block">
          CAN Database
        </label>

        {!dbcFile ? (
          <>
            <input
              type="file"
              accept=".dbc"
              ref={dbcInputRef}
              className="hidden"
              onChange={handleDbcUpload}
            />
            <button
              onClick={() => dbcInputRef.current?.click()}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800 transition"
            >
              Upload DBC File
            </button>
          </>
        ) : (
          <div className="rounded border border-green-600 bg-green-900/20 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white font-medium">{dbcFile.filename}</div>
                <div className="text-xs text-gray-400">{dbcFile.signals.length} signals</div>
              </div>
              <button
                onClick={handleClearDbc}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        )}
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
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.5em 1.5em',
          }}
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
      <div className="overflow-y-auto border-b border-gray-700 p-4 scrollbar-hide" style={{ maxHeight: '200px' }}>
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
        <div className="grid grid-cols-2 gap-2 overflow-y-auto scrollbar-hide" style={{ maxHeight: '400px' }}>
          {widgetTypes.map((t) => (
            <DraggableWidget key={t} widgetType={t} />
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center justify-between gap-2">
          {/* Save Configuration */}
          <button
            onClick={handleSave}
            className={`group relative flex h-12 w-12 items-center justify-center rounded transition-colors duration-200 ${
              activeScreen?.isDirty
                ? "bg-gray-700 hover:bg-orange-700"
                : "bg-gray-700 hover:bg-blue-700"
            }`}
            aria-label="Save configuration"
          >
            <Save className="h-5 w-5 text-white" />

            {/* Tooltip */}
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              {saveStatus || (activeScreen?.isDirty ? "Save *" : "Save")}
            </span>

            {/* Dirty indicator dot */}
            {activeScreen?.isDirty && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
            )}
          </button>

          {/* Commit Configuration */}
          <button
            onClick={handleCommit}
            className="group relative flex h-12 w-12 items-center justify-center rounded bg-gray-700 transition-colors duration-200 hover:bg-green-700"
            aria-label="Commit configuration"
          >
            <Check className="h-5 w-5 text-white" />

            {/* Tooltip */}
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Commit
            </span>
          </button>

          {/* Clear Widgets */}
          <button
            onClick={handleClearWidgets}
            className="group relative flex h-12 w-12 items-center justify-center rounded bg-gray-700 transition-colors duration-200 hover:bg-amber-700"
            aria-label="Clear all widgets"
          >
            <FileEdit className="h-5 w-5 text-white" />

            {/* Tooltip */}
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Clear Widgets
            </span>
          </button>

          {/* Delete Screen */}
          <button
            onClick={handleDeleteScreen}
            disabled={state.screens.length <= 1}
            className={`group relative flex h-12 w-12 items-center justify-center rounded transition-colors duration-200 ${
              state.screens.length <= 1
                ? "cursor-not-allowed bg-gray-700 opacity-40"
                : "bg-gray-700 hover:bg-red-800"
            }`}
            aria-label="Delete current screen"
          >
            <X className="h-5 w-5 text-white" />

            {/* Tooltip */}
            {state.screens.length > 1 && (
              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                Delete Screen
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
