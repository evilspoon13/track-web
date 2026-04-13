import { v4 as uuidv4 } from "uuid";
import type { EditorState, EditorAction, ScreenState } from "../types";

function nextDefaultScreenName(screens: ScreenState[]): string {
  const existing = new Set(screens.map((s) => s.name));
  let n = 1;
  while (existing.has(`Screen ${n}`)) n++;
  return `Screen ${n}`;
}

function prefsWithoutName(
  pinned: Set<string>,
  order: string[],
  name: string
): { pinned: Set<string>; order: string[]; changed: boolean } {
  const pinnedHad = pinned.has(name);
  const orderIdx = order.indexOf(name);
  if (!pinnedHad && orderIdx < 0) {
    return { pinned, order, changed: false };
  }
  const nextPinned = new Set(pinned);
  nextPinned.delete(name);
  const nextOrder = orderIdx >= 0 ? order.filter((n) => n !== name) : order;
  return { pinned: nextPinned, order: nextOrder, changed: true };
}

export function createInitialState(): EditorState {
  const screenId = uuidv4();
  return {
    screens: [{ id: screenId, name: "Screen 1", widgets: [] }],
    activeScreenId: screenId,
    selectedWidgetId: null,
    frameParserConfig: {},
    canIdsDirty: false,
    pinnedScreenNames: new Set<string>(),
    screenOrder: [],
    prefsDirty: false,
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

    case "UPDATE_WIDGET_DATA": {
      const { id, ...updates } = action.payload;
      return {
        ...state,
        screens: state.screens.map((screen) =>
          screen.id !== state.activeScreenId
            ? screen
            : {
                ...screen,
                widgets: screen.widgets.map((w) =>
                  w.id === id ? { ...w, ...updates } : w
                ),
                isDirty: true,
              }
        ),
      };
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
        name: nextDefaultScreenName(state.screens),
        widgets: [],
      };
      return {
        ...state,
        screens: [...state.screens, newScreen],
        activeScreenId: id,
        selectedWidgetId: null,
      };
    }

    case "UPSERT_SCREEN": {
      const { name, widgets } = action.payload;
      const existing =
        state.screens.find((s) => s.originalName === name) ??
        state.screens.find((s) => !s.originalName && s.name === name);
      if (existing) {
        if (existing.isDirty) return state;
        return {
          ...state,
          screens: state.screens.map((s) =>
            s.id === existing.id
              ? { ...s, name, originalName: name, widgets, isDirty: false }
              : s
          ),
        };
      }
      const id = uuidv4();
      return {
        ...state,
        screens: [
          ...state.screens,
          { id, name, originalName: name, widgets, isDirty: false },
        ],
      };
    }

    case "REMOVE_SCREEN_BY_NAME": {
      const target = state.screens.find((s) => s.originalName === action.payload.name);
      if (!target) return state;
      const remaining = state.screens.filter((s) => s.id !== target.id);
      const prefs = prefsWithoutName(state.pinnedScreenNames, state.screenOrder, action.payload.name);
      if (remaining.length === 0) {
        const id = uuidv4();
        const fresh = { id, name: nextDefaultScreenName([]), widgets: [] };
        return {
          ...state,
          screens: [fresh],
          activeScreenId: id,
          selectedWidgetId: null,
          pinnedScreenNames: prefs.pinned,
          screenOrder: prefs.order,
          prefsDirty: prefs.changed || state.prefsDirty,
        };
      }
      return {
        ...state,
        screens: remaining,
        activeScreenId:
          state.activeScreenId === target.id
            ? remaining[0]!.id
            : state.activeScreenId,
        selectedWidgetId: null,
        pinnedScreenNames: prefs.pinned,
        screenOrder: prefs.order,
        prefsDirty: prefs.changed || state.prefsDirty,
      };
    }

    case "REMOVE_SCREENS_BY_IDS": {
      const ids = new Set(action.payload.ids);
      if (ids.size === 0) return state;
      const removed = state.screens.filter((s) => ids.has(s.id));
      const remaining = state.screens.filter((s) => !ids.has(s.id));
      let pinned = state.pinnedScreenNames;
      let order = state.screenOrder;
      let changed = false;
      for (const s of removed) {
        if (!s.originalName) continue;
        const r = prefsWithoutName(pinned, order, s.originalName);
        pinned = r.pinned;
        order = r.order;
        changed = changed || r.changed;
      }
      if (remaining.length === 0) {
        const id = uuidv4();
        const fresh = { id, name: nextDefaultScreenName([]), widgets: [] };
        return {
          ...state,
          screens: [fresh],
          activeScreenId: id,
          selectedWidgetId: null,
          pinnedScreenNames: pinned,
          screenOrder: order,
          prefsDirty: changed || state.prefsDirty,
        };
      }
      const nextActiveId = ids.has(state.activeScreenId)
        ? remaining[0]!.id
        : state.activeScreenId;
      return {
        ...state,
        screens: remaining,
        activeScreenId: nextActiveId,
        selectedWidgetId: null,
        pinnedScreenNames: pinned,
        screenOrder: order,
        prefsDirty: changed || state.prefsDirty,
      };
    }

    case "CLEAR_SCREENS_BY_IDS": {
      const ids = new Set(action.payload.ids);
      if (ids.size === 0) return state;
      return {
        ...state,
        screens: state.screens.map((s) =>
          ids.has(s.id) ? { ...s, widgets: [], isDirty: true } : s
        ),
        selectedWidgetId: null,
      };
    }

    case "REMOVE_SCREEN": {
      const target = state.screens.find((s) => s.id === action.payload.id);
      const remaining = state.screens.filter(
        (s) => s.id !== action.payload.id
      );
      const targetName = target?.originalName;
      const prefs = targetName
        ? prefsWithoutName(state.pinnedScreenNames, state.screenOrder, targetName)
        : { pinned: state.pinnedScreenNames, order: state.screenOrder, changed: false };
      if (remaining.length === 0) {
        const id = uuidv4();
        const fresh = { id, name: nextDefaultScreenName([]), widgets: [] };
        return {
          ...state,
          screens: [fresh],
          activeScreenId: id,
          selectedWidgetId: null,
          pinnedScreenNames: prefs.pinned,
          screenOrder: prefs.order,
          prefsDirty: prefs.changed || state.prefsDirty,
        };
      }
      return {
        ...state,
        screens: remaining,
        activeScreenId:
          state.activeScreenId === action.payload.id
            ? remaining[0]!.id
            : state.activeScreenId,
        selectedWidgetId: null,
        pinnedScreenNames: prefs.pinned,
        screenOrder: prefs.order,
        prefsDirty: prefs.changed || state.prefsDirty,
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
        originalName: action.payload.name,
        widgets: action.payload.widgets,
        isDirty: false,
      };
      return {
        ...state,
        screens: [...state.screens, newScreen],
        activeScreenId: id,
        selectedWidgetId: null,
      };
    }

    case "LOAD_ALL_SCREENS": {
      if (action.payload.length === 0) return state;
      const screens = action.payload.map((s) => ({
        id: uuidv4(),
        name: s.name,
        originalName: s.name,
        widgets: s.widgets,
        isDirty: false,
      }));
      return {
        ...state,
        screens,
        activeScreenId: screens[0]!.id,
        selectedWidgetId: null,
      };
    }

    case "SET_FRAME_PARSER_CONFIG":
      return { ...state, frameParserConfig: action.payload.config };

    case "ADD_CAN_FRAME": {
      const { canId, frame } = action.payload;
      return {
        ...state,
        frameParserConfig: { ...state.frameParserConfig, [canId]: frame },
        canIdsDirty: true,
      };
    }

    case "UPDATE_CAN_FRAME": {
      const { canId, frame } = action.payload;
      return {
        ...state,
        frameParserConfig: { ...state.frameParserConfig, [canId]: frame },
        canIdsDirty: true,
      };
    }

    case "REMOVE_CAN_FRAME": {
      const next = { ...state.frameParserConfig };
      delete next[action.payload.canId];
      return { ...state, frameParserConfig: next, canIdsDirty: true };
    }

    case "MARK_CAN_IDS_CLEAN":
      return { ...state, canIdsDirty: false };

    case "SET_SCREEN_PREFS": {
      return {
        ...state,
        pinnedScreenNames: new Set(action.payload.pinnedNames),
        screenOrder: [...action.payload.order],
        prefsDirty: false,
      };
    }

    case "TOGGLE_PIN_SCREEN": {
      const next = new Set(state.pinnedScreenNames);
      if (next.has(action.payload.name)) next.delete(action.payload.name);
      else next.add(action.payload.name);
      return { ...state, pinnedScreenNames: next, prefsDirty: true };
    }

    case "REORDER_SCREENS": {
      return { ...state, screenOrder: [...action.payload.orderedNames], prefsDirty: true };
    }

    case "RENAME_SCREEN_IN_PREFS": {
      const { oldName, newName } = action.payload;
      const nextPinned = new Set<string>();
      for (const n of state.pinnedScreenNames) {
        nextPinned.add(n === oldName ? newName : n);
      }
      const nextOrder = state.screenOrder.map((n) => (n === oldName ? newName : n));
      return { ...state, pinnedScreenNames: nextPinned, screenOrder: nextOrder, prefsDirty: true };
    }

    case "MARK_PREFS_CLEAN":
      return { ...state, prefsDirty: false };

    case "CLEANUP_STALE_PREFS": {
      const liveNames = new Set<string>();
      for (const s of state.screens) {
        if (s.originalName) liveNames.add(s.originalName);
      }
      const nextPinned = new Set<string>();
      for (const n of state.pinnedScreenNames) {
        if (liveNames.has(n)) nextPinned.add(n);
      }
      const nextOrder = state.screenOrder.filter((n) => liveNames.has(n));
      const changed =
        nextPinned.size !== state.pinnedScreenNames.size ||
        nextOrder.length !== state.screenOrder.length;
      if (!changed) return state;
      return {
        ...state,
        pinnedScreenNames: nextPinned,
        screenOrder: nextOrder,
        prefsDirty: true,
      };
    }

    default:
      return state;
  }
}
