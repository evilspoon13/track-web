import { useState, useRef, useEffect } from "react";
import { Trash2, Pin } from "lucide-react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import { deleteScreen, saveScreen } from "../utils/layoutIO";
import type { ScreenState } from "../types";

const MAX_SCREEN_NAME_LENGTH = 50;

function partitionScreens(
  screens: ScreenState[],
  pinnedNames: Set<string>,
  order: string[]
): { pinned: ScreenState[]; unpinned: ScreenState[] } {
  const byName = new Map<string, ScreenState>();
  for (const s of screens) {
    if (s.originalName) byName.set(s.originalName, s);
  }

  const pinned: ScreenState[] = [];
  for (const name of pinnedNames) {
    const s = byName.get(name);
    if (s) pinned.push(s);
  }

  const unpinned: ScreenState[] = [];
  const seen = new Set<string>();
  for (const name of order) {
    if (pinnedNames.has(name)) continue;
    const s = byName.get(name);
    if (s) {
      unpinned.push(s);
      seen.add(name);
    }
  }
  for (const s of screens) {
    const name = s.originalName;
    if (name && pinnedNames.has(name)) continue;
    if (name && seen.has(name)) continue;
    unpinned.push(s);
  }

  return { pinned, unpinned };
}

export default function ScreenTabs() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

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

  const handleSaveName = async (screenId: string) => {
    const screen = state.screens.find((s) => s.id === screenId);
    if (!screen) return;

    const trimmedName = editValue.trim();
    if (!trimmedName) {
      setError("Name cannot be empty");
      return;
    }

    const duplicate = state.screens.some(
      (s) => s.id !== screenId && s.name === trimmedName
    );
    if (duplicate) {
      setError("Name already in use");
      return;
    }

    const oldName = screen.originalName;
    if (oldName && oldName !== trimmedName) {
      await deleteScreen(oldName);
    }

    if (trimmedName !== screen.name) {
      dispatch({
        type: "SET_SCREEN_NAME",
        payload: { id: screenId, name: trimmedName },
      });
      dispatch({
        type: "UPDATE_ORIGINAL_NAME",
        payload: { id: screenId, originalName: trimmedName },
      });
      if (oldName && oldName !== trimmedName) {
        dispatch({
          type: "RENAME_SCREEN_IN_PREFS",
          payload: { oldName, newName: trimmedName },
        });
      }
      await saveScreen(
        { name: trimmedName, widgets: screen.widgets },
        state.frameParserConfig
      );
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

  const { pinned, unpinned } = partitionScreens(
    state.screens,
    state.pinnedScreenNames,
    state.screenOrder
  );
  const sortableUnpinned = unpinned.filter((s) => !!s.originalName);
  const drafts = unpinned.filter((s) => !s.originalName);

  const handleTabDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sortableUnpinned.findIndex((s) => s.id === active.id);
    const newIdx = sortableUnpinned.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(sortableUnpinned, oldIdx, newIdx);
    const orderedNames = reordered
      .map((s) => s.originalName)
      .filter((n): n is string => typeof n === "string");
    dispatch({ type: "REORDER_SCREENS", payload: { orderedNames } });
  };

  return (
    <>
      {pinned.map((screen) => (
        <TabRow
          key={screen.id}
          screen={screen}
          isActive={screen.id === state.activeScreenId}
          isEditing={editingId === screen.id}
          isPinned={true}
          screensCount={state.screens.length}
          editValue={editValue}
          error={error}
          inputRef={editingId === screen.id ? inputRef : undefined}
          onClick={() => dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: screen.id } })}
          onDoubleClick={() => handleDoubleClick(screen)}
          onEditChange={(v) => { setEditValue(v); setError(""); }}
          onEditBlur={() => handleSaveName(screen.id)}
          onEditKeyDown={(e) => handleKeyDown(e, screen.id)}
          onTrashClick={() => dispatch({ type: "REMOVE_SCREEN", payload: { id: screen.id } })}
          onPinClick={() => {
            if (!screen.originalName) return;
            dispatch({ type: "TOGGLE_PIN_SCREEN", payload: { name: screen.originalName } });
          }}
        />
      ))}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
        <SortableContext items={sortableUnpinned.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sortableUnpinned.map((screen) => (
            <SortableTabRow
              key={screen.id}
              screen={screen}
              isActive={screen.id === state.activeScreenId}
              isEditing={editingId === screen.id}
              isPinned={false}
              screensCount={state.screens.length}
              editValue={editValue}
              error={error}
              inputRef={editingId === screen.id ? inputRef : undefined}
              onClick={() => dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: screen.id } })}
              onDoubleClick={() => handleDoubleClick(screen)}
              onEditChange={(v) => { setEditValue(v); setError(""); }}
              onEditBlur={() => handleSaveName(screen.id)}
              onEditKeyDown={(e) => handleKeyDown(e, screen.id)}
              onTrashClick={() => dispatch({ type: "REMOVE_SCREEN", payload: { id: screen.id } })}
              onPinClick={() => {
                if (!screen.originalName) return;
                dispatch({ type: "TOGGLE_PIN_SCREEN", payload: { name: screen.originalName } });
              }}
            />
          ))}
        </SortableContext>
      </DndContext>

      {drafts.map((screen) => (
        <TabRow
          key={screen.id}
          screen={screen}
          isActive={screen.id === state.activeScreenId}
          isEditing={editingId === screen.id}
          isPinned={false}
          screensCount={state.screens.length}
          editValue={editValue}
          error={error}
          inputRef={editingId === screen.id ? inputRef : undefined}
          onClick={() => dispatch({ type: "SET_ACTIVE_SCREEN", payload: { id: screen.id } })}
          onDoubleClick={() => handleDoubleClick(screen)}
          onEditChange={(v) => { setEditValue(v); setError(""); }}
          onEditBlur={() => handleSaveName(screen.id)}
          onEditKeyDown={(e) => handleKeyDown(e, screen.id)}
          onTrashClick={() => dispatch({ type: "REMOVE_SCREEN", payload: { id: screen.id } })}
          onPinClick={() => { /* drafts cannot pin */ }}
        />
      ))}

      <button
        onClick={() => dispatch({ type: "ADD_SCREEN" })}
        className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600"
      >
        + New Screen
      </button>
    </>
  );
}

interface TabRowProps {
  screen: ScreenState;
  isActive: boolean;
  isEditing: boolean;
  isPinned: boolean;
  screensCount: number;
  editValue: string;
  error: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  onClick: () => void;
  onDoubleClick: () => void;
  onEditChange: (v: string) => void;
  onEditBlur: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onTrashClick: () => void;
  onPinClick: () => void;
}

function SortableTabRow(props: TabRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.screen.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Wrap listeners so pointerdown doesn't bubble to the outer DndContext
  // (which drives widget drags). Prevents spurious outer drag activation.
  const wrappedListeners = listeners
    ? {
        ...listeners,
        onPointerDown: (e: React.PointerEvent) => {
          e.stopPropagation();
          const orig = (listeners as { onPointerDown?: (e: React.PointerEvent) => void })
            .onPointerDown;
          orig?.(e);
        },
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...wrappedListeners}>
      <TabRow {...props} />
    </div>
  );
}

function TabRow({
  screen,
  isActive,
  isEditing,
  isPinned,
  screensCount,
  editValue,
  error,
  inputRef,
  onClick,
  onDoubleClick,
  onEditChange,
  onEditBlur,
  onEditKeyDown,
  onTrashClick,
  onPinClick,
}: TabRowProps) {
  if (isEditing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          maxLength={MAX_SCREEN_NAME_LENGTH}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditBlur}
          onKeyDown={onEditKeyDown}
          className={`w-full rounded border px-3 py-2 text-sm text-white focus:outline-none ${
            error ? "border-red-500 bg-red-900/20" : "border-blue-500 bg-gray-900"
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

  const canPin = !!screen.originalName;
  const canTrash = screensCount > 1 && !screen.originalName;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group flex w-full cursor-pointer items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
        isActive ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
    >
      <span className="flex items-center flex-1 truncate">
        <span className={screen.originalName ? "" : "italic"}>{screen.name}</span>
        {!screen.originalName && (
          <span className="ml-1.5 flex-shrink-0 text-[10px] text-gray-400">new</span>
        )}
        {screen.isDirty && (
          <span className="ml-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500" />
        )}
      </span>
      {canPin && (
        <span
          onClick={(e) => { e.stopPropagation(); onPinClick(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`ml-2 flex-shrink-0 transition ${
            isPinned
              ? "text-gray-200"
              : "text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-200"
          }`}
          title={isPinned ? "Unpin" : "Pin to top"}
        >
          <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
        </span>
      )}
      {canTrash && (
        <span
          onClick={(e) => { e.stopPropagation(); onTrashClick(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-2 flex-shrink-0 text-gray-400 hover:text-red-400"
          title="Dismiss draft"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
