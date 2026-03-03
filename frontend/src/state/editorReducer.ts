import { v4 as uuidv4 } from "uuid";
import type { EditorState, EditorAction } from "../types";

export function createInitialState(): EditorState {
  const screenId = uuidv4();
  return {
    screens: [{ id: screenId, name: "Screen 1", widgets: [] }],
    activeScreenId: screenId,
    selectedWidgetId: null,
    dbcFile: null,
  };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  const screenIdx = state.screens.findIndex(
    (s) => s.id === state.activeScreenId
  );

  switch (action.type) {
    case "ADD_WIDGET": {
      if (screenIdx === -1) return state;
      const screens = [...state.screens];
      screens[screenIdx] = {
        ...screens[screenIdx]!,
        widgets: [...screens[screenIdx]!.widgets, action.payload],
        isDirty: true,
      };
      return { ...state, screens, selectedWidgetId: action.payload.id };
    }

    case "MOVE_WIDGET": {
      if (screenIdx === -1) return state;
      const screens = [...state.screens];
      screens[screenIdx] = {
        ...screens[screenIdx]!,
        widgets: screens[screenIdx]!.widgets.map((w) =>
          w.id === action.payload.id
            ? { ...w, col: action.payload.col, row: action.payload.row }
            : w
        ),
        isDirty: true,
      };
      return { ...state, screens };
    }

    case "RESIZE_WIDGET": {
      if (screenIdx === -1) return state;
      const screens = [...state.screens];
      screens[screenIdx] = {
        ...screens[screenIdx]!,
        widgets: screens[screenIdx]!.widgets.map((w) =>
          w.id === action.payload.id
            ? { ...w, cols: action.payload.cols, rows: action.payload.rows }
            : w
        ),
        isDirty: true,
      };
      return { ...state, screens };
    }

    case "REMOVE_WIDGET": {
      if (screenIdx === -1) return state;
      const screens = [...state.screens];
      screens[screenIdx] = {
        ...screens[screenIdx]!,
        widgets: screens[screenIdx]!.widgets.filter(
          (w) => w.id !== action.payload.id
        ),
        isDirty: true,
      };
      return {
        ...state,
        screens,
        selectedWidgetId:
          state.selectedWidgetId === action.payload.id
            ? null
            : state.selectedWidgetId,
      };
    }

    case "SELECT_WIDGET":
      return { ...state, selectedWidgetId: action.payload.id };

    case "UPDATE_WIDGET_LABEL": {
      if (screenIdx === -1) return state;
      const screens = [...state.screens];
      screens[screenIdx] = {
        ...screens[screenIdx]!,
        widgets: screens[screenIdx]!.widgets.map((w) =>
          w.id === action.payload.id
            ? { ...w, label: action.payload.label }
            : w
        ),
        isDirty: true,
      };
      return { ...state, screens };
    }

    case "CLEAR_SCREEN": {
      if (screenIdx === -1) return state;
      const screens = [...state.screens];
      screens[screenIdx] = {
        ...screens[screenIdx]!,
        widgets: [],
        isDirty: true,
      };
      return { ...state, screens, selectedWidgetId: null };
    }

    case "ADD_SCREEN": {
      const id = uuidv4();
      const newScreen = {
        id,
        name: `Screen ${state.screens.length + 1}`,
        widgets: [],
      };
      return {
        ...state,
        screens: [...state.screens, newScreen],
        activeScreenId: id,
        selectedWidgetId: null,
      };
    }

    case "REMOVE_SCREEN": {
      if (state.screens.length <= 1) return state;
      const remaining = state.screens.filter(
        (s) => s.id !== action.payload.id
      );
      return {
        ...state,
        screens: remaining,
        activeScreenId:
          state.activeScreenId === action.payload.id
            ? remaining[0]!.id
            : state.activeScreenId,
        selectedWidgetId: null,
      };
    }

    case "SET_ACTIVE_SCREEN":
      return {
        ...state,
        activeScreenId: action.payload.id,
        selectedWidgetId: null,
      };

    case "SET_SCREEN_NAME": {
      const screens = state.screens.map((s) => {
        if (s.id !== action.payload.id) return s;
        // Keep originalName unchanged, only update current name
        return { ...s, name: action.payload.name };
      });
      return { ...state, screens };
    }

    case "MARK_CLEAN": {
      const screens = state.screens.map((s) =>
        s.id === action.payload.id ? { ...s, isDirty: false } : s
      );
      return { ...state, screens };
    }

    case "UPDATE_ORIGINAL_NAME": {
      const screens = state.screens.map((s) =>
        s.id === action.payload.id
          ? { ...s, originalName: action.payload.originalName }
          : s
      );
      return { ...state, screens };
    }

    case "LOAD_SCREEN": {
      const id = uuidv4();
      const newScreen = {
        id,
        name: action.payload.name,
        originalName: action.payload.name, // Track original name
        widgets: action.payload.widgets,
        isDirty: false, // Loaded screens are clean
      };
      return {
        ...state,
        screens: [...state.screens, newScreen],
        activeScreenId: id,
        selectedWidgetId: null,
      };
    }

    case "LOAD_DBC":
      return { ...state, dbcFile: action.payload };

    case "CLEAR_DBC":
      return { ...state, dbcFile: null };

    case "UPDATE_WIDGET_CAN": {
      const { id, canId, canIdSource } = action.payload;
      return {
        ...state,
        screens: state.screens.map((screen) =>
          screen.id === state.activeScreenId
            ? {
                ...screen,
                widgets: screen.widgets.map((w) =>
                  w.id === id ? { ...w, canId, canIdSource } : w
                ),
                isDirty: true,
              }
            : screen
        ),
      };
    }

    default:
      return state;
  }
}
