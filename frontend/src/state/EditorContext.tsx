import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type Dispatch,
  type ReactNode,
} from "react";
import type { EditorState, EditorAction } from "../types";
import { editorReducer, createInitialState } from "./editorReducer";
import { getFrameParserConfig } from "../utils/layoutIO";

const EditorStateContext = createContext<EditorState | null>(null);
const EditorDispatchContext = createContext<Dispatch<EditorAction> | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, null, createInitialState);

  useEffect(() => {
    getFrameParserConfig().then((config) =>
      dispatch({ type: "SET_FRAME_PARSER_CONFIG", payload: { config } })
    );
  }, []);

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
