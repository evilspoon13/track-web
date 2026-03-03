import { useState, useRef, useEffect } from "react";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { deleteScreen, saveScreen } from "../utils/layoutIO";

const MAX_SCREEN_NAME_LENGTH = 50;

export default function ScreenTabs() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = (screen: { id: string; name: string }) => {
    setEditingId(screen.id);
    setEditValue(screen.name);
    setError("");
  };

  const handleSaveName = (screenId: string) => {
    const screen = state.screens.find((s) => s.id === screenId);
    if (!screen) return;

    const trimmedName = editValue.trim();

    // Validate
    if (!trimmedName) {
      setError("Name cannot be empty");
      return;
    }

    // Check for duplicates
    const duplicate = state.screens.some(
      (s) => s.id !== screenId && s.name === trimmedName
    );
    if (duplicate) {
      setError("Name already in use");
      return;
    }

    // If renamed, delete old entry from localStorage
    if (screen.originalName && screen.originalName !== trimmedName) {
      deleteScreen(screen.originalName);
    }

    // Update name in state
    if (trimmedName !== screen.name) {
      dispatch({
        type: "SET_SCREEN_NAME",
        payload: { id: screenId, name: trimmedName },
      });

      // Update original name
      dispatch({
        type: "UPDATE_ORIGINAL_NAME",
        payload: { id: screenId, originalName: trimmedName },
      });

      // Save to localStorage immediately so dropdown updates
      saveScreen({
        name: trimmedName,
        widgets: screen.widgets,
      });
    }

    setEditingId(null);
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, screenId: string) => {
    if (e.key === "Enter") {
      handleSaveName(screenId);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setError("");
    }
  };

  return (
    <>
      {state.screens.map((screen) => {
        const isEditing = editingId === screen.id;
        const isActive = screen.id === state.activeScreenId;

        if (isEditing) {
          return (
            <div key={screen.id} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                maxLength={MAX_SCREEN_NAME_LENGTH}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  setError("");
                }}
                onBlur={() => handleSaveName(screen.id)}
                onKeyDown={(e) => handleKeyDown(e, screen.id)}
                className={`w-full rounded border px-3 py-2 text-sm text-white focus:outline-none ${
                  error
                    ? "border-red-500 bg-red-900/20"
                    : "border-blue-500 bg-gray-900"
                }`}
              />
              {error && (
                <div className="absolute left-0 top-full z-10 mt-1 rounded bg-red-700 px-2 py-1 text-xs text-white shadow-lg">
                  {error}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={screen.id}
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: screen.id } })
            }
            onDoubleClick={() => handleDoubleClick(screen)}
            className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <span className="flex-1 truncate">
              {screen.name}
              {screen.isDirty ? " *" : ""}
            </span>
            {state.screens.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: "REMOVE_SCREEN",
                    payload: { id: screen.id },
                  });
                }}
                className="ml-2 text-gray-400 hover:text-red-400"
              >
                ×
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={() => dispatch({ type: "ADD_SCREEN" })}
        className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600"
      >
        + New Screen
      </button>
    </>
  );
}
