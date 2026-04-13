import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import type { EditorState, EditorAction } from "../types";
import { editorReducer, createInitialState } from "./editorReducer";
import { getDbc, listScreens, loadScreen, getScreenPrefs, saveScreenPrefs } from "../utils/layoutIO";

const EditorStateContext = createContext<EditorState | null>(null);
const EditorDispatchContext = createContext<Dispatch<EditorAction> | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, null, createInitialState);
  const screensLoadedRef = useRef(false);
  const prefsLoadedRef = useRef(false);
  const cleanupDoneRef = useRef(false);

  const maybeCleanupStalePrefs = () => {
    if (
      screensLoadedRef.current &&
      prefsLoadedRef.current &&
      !cleanupDoneRef.current
    ) {
      cleanupDoneRef.current = true;
      dispatch({ type: "CLEANUP_STALE_PREFS" });
    }
  };

  useEffect(() => {
    getDbc().then((config) => {
      dispatch({ type: "SET_FRAME_PARSER_CONFIG", payload: { config } });
    });

    listScreens().then(async (names) => {
      if (names.length > 0) {
        const screens = (await Promise.all(names.map(loadScreen))).filter(
          (s): s is NonNullable<typeof s> => s !== null
        );
        if (screens.length > 0) {
          dispatch({ type: "LOAD_ALL_SCREENS", payload: screens });
        }
      }
      screensLoadedRef.current = true;
      maybeCleanupStalePrefs();
    });

    getScreenPrefs().then((prefs) => {
      dispatch({ type: "SET_SCREEN_PREFS", payload: prefs });
      prefsLoadedRef.current = true;
      maybeCleanupStalePrefs();
    });
  }, []);

  useEffect(() => {
    if (!state.prefsDirty) return;
    const timer = window.setTimeout(() => {
      saveScreenPrefs({
        pinnedNames: Array.from(state.pinnedScreenNames),
        order: state.screenOrder,
      })
        .then(() => dispatch({ type: "MARK_PREFS_CLEAN" }))
        .catch(() => {
          // leave prefsDirty true — retry on next change
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state.prefsDirty, state.pinnedScreenNames, state.screenOrder]);

  useEffect(() => {
    const isDirty =
      state.canIdsDirty ||
      state.screens.some((s) => s.isDirty);
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.canIdsDirty, state.screens]);

  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={dispatch}>
        {children}
      </EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  );
}

export function useEditorState(): EditorState {
  const ctx = useContext(EditorStateContext);
  if (!ctx) throw new Error("useEditorState must be used within EditorProvider");
  return ctx;
}

export function useEditorDispatch(): Dispatch<EditorAction> {
  const ctx = useContext(EditorDispatchContext);
  if (!ctx)
    throw new Error("useEditorDispatch must be used within EditorProvider");
  return ctx;
}
