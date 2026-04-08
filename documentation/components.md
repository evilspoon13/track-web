# Key Component Reference

Eight components make up the core of the editor. Each entry covers purpose, file location, state consumed from `EditorContext`, actions dispatched, and any side-effects or API calls.

---

## EditorLayout

**Purpose:** Top-level shell for the editor UI. Owns the drag-and-drop context, page switching (`display` / `telemetry` / `logs`), and cell size calculation. It is the parent of every other editor component.

**Location:** `src/EditorLayout.tsx`

**State consumed:**
- `state.screens` — to pass the active screen's widgets to `GridCanvas`
- `state.activeScreenId` — to find the active screen
- `state.selectedWidgetId` — passed down to `ConfigPanel`

**Local state:**
- `page` — current view (`"display"` | `"telemetry"` | `"logs"`)
- `cellWidth` / `cellHeight` — computed pixel size of each grid cell, recalculated on window resize

**Actions dispatched:**
- `MOVE_WIDGET` — on drag-end when moving an existing widget
- `ADD_WIDGET` — on drag-end when dropping a new widget from the palette

**Side-effects:**
- Attaches a `resize` event listener on mount to recompute `cellWidth`/`cellHeight`
- Manages `@dnd-kit` `DndContext` with `restrictToWindowEdge` modifier

---

## Navbar

**Purpose:** Left sidebar that hosts the widget palette, screen load/save/delete controls, DBC upload, and driver display selector. The primary entry point for most user-initiated actions.

**Location:** `src/components/Navbar.tsx`

**State consumed:**
- `state.screens` — to list screens in save modal and check dirty flags
- `state.frameParserConfig` — passed to `CanIdConfigurator` and used during save
- `state.driverDisplayScreen` — shown in driver display selector
- `state.driverDisplayDirty`, `state.canIdsDirty` — to determine orange dot on Save button

**Actions dispatched:**
- `ADD_SCREEN` — new screen button
- `REMOVE_SCREEN` — delete screen button
- `CLEAR_SCREEN` — clear all widgets on active screen
- `SET_DRIVER_DISPLAY` — driver display dropdown selection
- `MARK_CLEAN`, `MARK_DRIVER_DISPLAY_CLEAN`, `MARK_CAN_IDS_CLEAN` — after successful save
- `UPDATE_ORIGINAL_NAME` — after save to track backend name for rename detection
- `SET_FRAME_PARSER_CONFIG` — after DBC upload, replaces all frame definitions
- `LOAD_SCREEN` — after loading a screen from backend

**API calls (via layoutIO.ts):**
- `saveScreen()` → POST `/api/graphics/screens/{name}`
- `deleteScreen()` → DELETE `/api/graphics/screens/{name}`
- `setDriverDisplay()` → POST `/api/graphics/driver-display`
- `saveDbc()` → POST `/api/dbc`
- `uploadDbc()` → POST `/api/dbc/upload`
- `listScreens()` → GET `/api/graphics/screens`
- `loadScreen()` → GET `/api/graphics/screens/{name}`

---

## ScreenTabs

**Purpose:** Horizontal tab strip above the canvas. Lets the user switch between open screens, rename them inline, and delete them.

**Location:** `src/components/ScreenTabs.tsx`

**State consumed:**
- `state.screens` — to render a tab for each screen
- `state.activeScreenId` — to highlight the active tab

**Local state:**
- `editingId` — which tab is currently in inline rename mode
- `editValue` — current text in the rename input

**Actions dispatched:**
- `SET_ACTIVE_SCREEN` — clicking a tab
- `SET_SCREEN_NAME` — committing a rename (Enter / blur)
- `REMOVE_SCREEN` — clicking the X on a tab

**Visual indicator:** An orange dot is shown on tabs where `screen.isDirty === true`.

---

## GridCanvas

**Purpose:** The 10×6 droppable surface. Renders the grid lines and all `PlacedWidget` instances for the active screen. Reports drop positions back to `EditorLayout` via a callback.

**Location:** `src/components/GridCanvas.tsx`

**Props:**
- `widgets: PlacedWidget[]` — widgets to render
- `cellWidth`, `cellHeight` — pixel dimensions of each cell
- `selectedWidgetId` — which widget to highlight

**State consumed:** None directly (data passed via props from `EditorLayout`).

**Actions dispatched:**
- `SELECT_WIDGET` — clicking on a widget or clicking the empty grid

**Notes:**
- Uses `@dnd-kit` `useDroppable` to receive drag events from `EditorLayout`
- Drop coordinate math (`pixelToGrid`) happens in `EditorLayout`, not here

---

## ConfigPanel

**Purpose:** Right-side property editor. Appears when a widget is selected. Lets the user bind the widget to a CAN signal and configure its display properties.

**Location:** `src/components/ConfigPanel.tsx`

**State consumed:**
- `state.selectedWidgetId` — to find the widget being edited
- `state.screens` / `state.activeScreenId` — to read current widget data
- `state.frameParserConfig` — to populate CAN ID and signal dropdowns

**Actions dispatched:**
- `UPDATE_WIDGET_DATA` — any field change (CAN ID, signal, unit, min, max, thresholds, alarm)
- `RESIZE_WIDGET` — size selector dropdown change
- `REMOVE_WIDGET` — delete button

**Notes:**
- Size dropdown only shows options from `allowedSizes` that would not cause a collision with other widgets (`hasCollision` check before rendering each option)
- CAN ID dropdown populates from `frameParserConfig` keys; signal dropdown populates from the selected frame's `signals` array

---

## CanIdConfigurator

**Purpose:** Modal for manually managing CAN frame definitions. Alternative to uploading a .dbc file. Lets the user add frames, define signals per frame, and delete frames.

**Location:** `src/components/CanIdConfigurator.tsx`

**Props:**
- `frameParserConfig: FrameParserConfig` — current frame definitions
- `onClose` — dismiss callback

**State consumed:** None from context (receives config as props).

**Actions dispatched (via parent callback):**
- `ADD_CAN_FRAME` — user adds a new frame
- `UPDATE_CAN_FRAME` — user edits an existing frame or its signals
- `REMOVE_CAN_FRAME` — user deletes a frame

**Notes:**
- Each frame has a `can_id_label` (human-readable name) and an array of `FrameSignal` objects
- Signal fields: `name`, `start_byte`, `length`, `type` (SignalType), `scale`, `offset`

---

## TelemetryPage

**Purpose:** Live telemetry dashboard. Subscribes to the backend WebSocket and renders signal cards using the driver display screen's widget configuration.

**Location:** `src/components/TelemetryPage.tsx`

**State consumed:**
- `state.driverDisplayScreen` — which screen's widget config to use for cards
- `state.screens` — to look up the driver display screen's widget array
- `state.frameParserConfig` — to resolve signal names

**Local state:**
- `signalHistory: Map<string, number[]>` — rolling buffer of last 30 values per signal
- `connected: boolean` — WebSocket connection status

**Side-effects:**
- Opens a WebSocket to `ws://{host}/ws/client` on mount
- Sends `{ type: "auth", token }` message immediately after connect
- Parses `{ type: "Telemetry", payload: { signals } }` messages and updates `signalHistory`
- Closes WebSocket on unmount

**Card types rendered per widget.type:**

| type | Renders |
|------|---------|
| `gauge` | Circular arc gauge with caution/critical color zones |
| `bar` | Horizontal fill bar, color-coded by threshold |
| `number` | Large numeric value with unit label |
| `graph` | Scrolling line graph over last 30 values |
| `indicator` | Colored dot (green / yellow / red) |

---

## LogTerminalPage

**Purpose:** Resizable split-panel log viewer. History panel on the left, live telemetry feed on the right, separated by a draggable divider. Supports day-based log browsing with session grouping and XLSX export.

**Location:** `src/components/LogTerminalPage.tsx`

**State consumed:**
- `useTelemetry()` — `rawMessages` (live signal stream) and `connected` (WebSocket status)
- `useEditorState()` — `frameParserConfig` to resolve CAN IDs to human-readable frame names in the live feed

**Local state:**
- `days: DaySummary[]` — list of available log days fetched on mount
- `expandedDay: string | null` — which day is currently expanded in the history panel
- `dayData: Record<string, DayData>` — per-day log entries, pagination cursor, and loading flag
- `dateFilter: string` — date input value used to filter the day list
- `downloading: string | null` — tracks which day (or `"all"`) is currently exporting
- `leftPct: number` — left panel width percentage, initialized from `localStorage("log-split-pct")` (default 50)

**Layout:**
- Two panels in a horizontal flex container with a 4 px draggable divider between them
- Divider width is clamped between 20% and 80%; final position is persisted to `localStorage` under the key `log-split-pct` on mouse-up
- Left panel (history): hidden scrollbar, day-based accordion with session grouping
- Right panel (live feed): themed scrollbar (dark gray track and thumb, visible on hover)

**History panel features:**
- Header contains a date filter input and a "DOWNLOAD ALL" button
- Each day row shows a formatted date, entry count, and an XLSX download button
- Clicking a day expands it and fetches the first 100 entries via `fetchLogs({ date, limit: 100 })`
- Entries are grouped by `session` field with a separator between groups
- A "load more" button at the bottom of an expanded day fetches the next page via cursor

**Live feed panel features:**
- Header shows a connection indicator dot (green/red) and status label
- Renders `rawMessages` from `useTelemetry()`, resolving CAN IDs to frame names via `frameParserConfig`
- Auto-scrolls to the bottom when the user is already near the bottom (`isAtBottomRef` threshold: 40 px)

**Side-effects:**
- Fetches day list via `fetchLogDays()` on mount
- Reads `localStorage("log-split-pct")` on mount to restore panel width
- Writes `localStorage("log-split-pct")` on divider mouse-up
- Attaches temporary `mousemove`/`mouseup` listeners on `document` during divider drag

**API calls (via layoutIO.ts):**
- `fetchLogDays()` — list available log days with entry counts
- `fetchLogs({ date, limit, before? })` — paginated log entries for a given day
- XLSX export iterates all pages for a day (or all days) using `fetchLogs` in a loop, then writes via the `xlsx` library
