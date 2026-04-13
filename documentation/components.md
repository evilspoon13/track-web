# Key Component Reference

The editor UI is built from a small set of stateful components. Each entry below covers purpose, file location, state consumed from `EditorContext` / `TelemetryContext`, actions dispatched, and notable side-effects or API calls.

---

## EditorLayout

**Purpose:** Top-level shell for the authenticated app. Owns the drag-and-drop context, the page switcher (`display` | `telemetry` | `logs` | `device`), the header (logo, tab strip with animated underline, connection dot, user menu), and cell-size computation for the grid.

**Location:** `src/EditorLayout.tsx`

**State consumed:**
- `state.screens` — to pass the active screen's widgets to `GridCanvas`
- `state.activeScreenId` — to find the active screen
- `connected` (from `useTelemetry`) — to render the header connection dot

**Local state:**
- `page` — current view (`"display"` | `"telemetry"` | `"logs"` | `"device"`)
- `cellSize` — computed `{ w, h }` of each grid cell, recalculated on window resize
- `activeType` / `activeWidgetId` — currently dragged palette type or existing widget ID
- `settingsOpen` — user menu dropdown state
- `indicator` — pixel position + width of the active tab underline

**Actions dispatched:**
- `ADD_WIDGET` — on drag-end when dropping from the palette (tries default size, falls back to other allowed sizes, aborts if nothing fits)
- `MOVE_WIDGET` — on drag-end when moving an existing widget

**Side-effects:**
- `resize` listener that re-fits the canvas to `10 / 6` aspect ratio
- Renders a `DragOverlay` with a bouncy drop animation for the active preview widget

---

## Navbar

**Purpose:** Left sidebar on the Editor page. Hosts the DBC upload control, the widget palette (5 types), the `ScreenTabs` list, and the Save / Clear / Delete action buttons with confirmation modals.

**Location:** `src/components/Navbar.tsx`

**State consumed:**
- `state.screens` — to count dirty screens and find the active screen
- `state.frameParserConfig` — passed as `can_id_label` lookup during save
- `state.canIdsDirty` — drives the "and CAN ID definitions" line in the save modal and the orange dot on the Save button

**Actions dispatched:**
- `SET_FRAME_PARSER_CONFIG`, `MARK_CAN_IDS_CLEAN` — after a DBC upload
- `UPDATE_ORIGINAL_NAME`, `MARK_CLEAN` — per screen after a successful save
- `CLEAR_SCREEN` — Clear button
- `REMOVE_SCREEN` — Delete Screen button

**API calls (via `layoutIO.ts`):**
- `uploadDbc(content)` → POST `/api/dbc/upload`
- `saveScreen(screen, fpc)` → POST `/api/graphics/screens/{name}` — called in parallel for **every dirty screen** on a single save click (not just the active one)
- `saveDbc(fpc)` → POST `/api/dbc`
- `deleteScreen(name)` → DELETE `/api/graphics/screens/{name}`

**Notes:**
- The Save modal reports what will actually happen: either `"This will save N screens and CAN ID definitions."` or the subset that applies.
- Save button glows teal when any screen is dirty or `canIdsDirty`; otherwise hovers to blue.

---

## ScreenTabs

**Purpose:** Vertical tab list inside `Navbar`. Splits screens into two sections — **pinned** (static order, always on top) and **unpinned** (drag-reorderable). Supports inline rename, pin/unpin, bulk selection with checkboxes, and bulk delete with a confirmation modal.

**Location:** `src/components/ScreenTabs.tsx`

**State consumed:**
- `state.screens` / `state.activeScreenId`
- `state.pinnedScreenNames` — `Set<string>` of screen names that are pinned
- `state.screenOrder` — `string[]` of screen names in user-chosen order (unpinned section)
- `state.frameParserConfig` — passed to `saveScreen` on rename

**Local state:**
- `editingId`, `editValue`, `error` — inline rename state
- `selectedIds` — bulk-select checkboxes
- `showBulkDelete` — confirm modal visibility

**Actions dispatched:**
- `SET_ACTIVE_SCREEN` — tab click
- `SET_SCREEN_NAME`, `UPDATE_ORIGINAL_NAME`, `RENAME_SCREEN_IN_PREFS` — on rename commit
- `REMOVE_SCREEN` — X / trash on a single tab
- `REMOVE_SCREENS_BY_IDS` — bulk delete confirm
- `TOGGLE_PIN_SCREEN` — pin icon click (pinning / unpinning auto-saves via the prefs debounce)
- `REORDER_SCREENS` — after an `@dnd-kit/sortable` drag-end in the unpinned section
- `ADD_SCREEN` — the `+ New Screen` button

**API calls:**
- `deleteScreen(name)` — called for each `originalName` in a bulk delete, and also on rename to remove the old doc before saving the new one
- `saveScreen(...)` — called on rename commit to save the renamed screen

**Notes:**
- `partitionScreens()` is the canonical ordering logic: pinned names in `pinnedScreenNames` iteration order, then saved unpinned names in `screenOrder`, then any saved screens missing from `screenOrder`, then drafts (no `originalName`).
- Drafts (unsaved new screens) cannot be pinned and cannot be selected for bulk delete.
- The inner sortable `DndContext` stops `pointerdown` propagation so the outer widget `DndContext` in `EditorLayout` isn't triggered.

---

## GridCanvas

**Purpose:** The 10×6 droppable surface. Renders grid cells and all `PlacedWidget` instances for the active screen. Drop coordinate math (`pixelToGrid`, collision fallback to other allowed sizes) is handled by `EditorLayout` — this component is just a droppable container.

**Location:** `src/components/GridCanvas.tsx`

**Props:** `cellWidth`, `cellHeight`.

**Actions dispatched:** `SELECT_WIDGET` — on empty-grid click (deselect).

---

## ConfigPanel

**Purpose:** Right-side scrollable property editor. Top half is the always-visible `CanIdConfigurator`. Bottom half is the widget property form, which appears once a widget is selected. A pinned "Delete Widget" button sits at the bottom.

**Location:** `src/components/ConfigPanel.tsx`

**State consumed:**
- `state.selectedWidgetId`, `state.screens`, `state.activeScreenId` — to resolve the widget being edited
- `state.frameParserConfig` — to populate Frame + Signal dropdowns

**Actions dispatched:**
- `UPDATE_WIDGET_DATA` — any field change (frame, signal, unit, min, max, caution/critical, alarm toggle, graph config)
- `RESIZE_WIDGET` — Size dropdown change
- `REMOVE_WIDGET` — Delete Widget button

**Form layout:**
- Frame + Signal (2-col)
- Unit + [Size + Alarm toggle] (2-col)
- Min + Max (2-col)
- Caution + Critical (2-col)
- For `graph` widgets: Mode (time_series | xy), Max Points, Window (time_series) or X Frame / X Signal / X Unit / X Min / X Max (xy)

**Notes:**
- The Size dropdown only offers sizes that would not collide with other widgets (checked via `hasCollision`), and always includes the currently selected size.
- Field dropdowns use the `AnimatedSelect` component rather than native `<select>` for consistent dark-theme styling.

---

## CanIdConfigurator

**Purpose:** Inline panel (embedded in `ConfigPanel`) for managing CAN frame definitions manually. Complements DBC upload in `Navbar`.

**Location:** `src/components/CanIdConfigurator.tsx`

**Actions dispatched (via context):** `ADD_CAN_FRAME`, `UPDATE_CAN_FRAME`, `REMOVE_CAN_FRAME`. All three flip `canIdsDirty = true`.

**Notes:** Each frame has a `can_id_label` plus an array of `FrameSignal` entries (`name`, `start_byte`, `length`, `type`, `scale`, `offset`).

---

## AnimatedSelect

**Purpose:** Reusable custom select dropdown with an animated open, dark theme, and outside-click dismiss. Replaces native `<select>` in `ConfigPanel`.

**Location:** `src/components/AnimatedSelect.tsx`

**Props:** `value`, `onChange(value)`, `options: { value, label }[]`, `disabled?`, `className?`, `style?`.

---

## TelemetryPage

**Purpose:** Live telemetry dashboard. Renders one auto-scaling line-graph card per signal currently streaming from `TelemetryContext`. No longer depends on the editor's widget config — every incoming signal gets its own `GraphCard` and the grid auto-tiles (1–2–3 columns based on signal count, with the last row stretching to fill).

**Location:** `src/components/TelemetryPage.tsx`

**State consumed:**
- `frameParserConfig` — to resolve `{canId}:{signal}` keys into human-readable frame labels
- `signals` (from `useTelemetry`) — rolling 30-value history per signal key

**GraphCard features:**
- SVG polyline + faded area fill
- 4-tick Y-axis (auto-scaled to `min / max` of the rolling window)
- Current value displayed top-right
- Hover cursor + tooltip with the exact value at that x position

**Notes:**
- The TelemetryContext WebSocket is shared with `LogTerminalPage` — `TelemetryPage` does not open its own socket.

---

## LogTerminalPage

**Purpose:** Resizable split-panel log viewer. History on the left (accordion of days → session groups → entries), live feed on the right, separated by a draggable divider persisted to `localStorage` under `log-split-pct` (default 33, clamped 20–80).

**Location:** `src/components/LogTerminalPage.tsx`

**State consumed:**
- `rawMessages`, `connected` (from `useTelemetry`) — live feed content + header dot
- `frameParserConfig` — resolves CAN IDs to frame labels in the live feed

**Local state:**
- `days: DaySummary[]` + `daysLoading` — loaded on mount via `fetchLogDays()`
- `expandedDay` + `dayData` — lazily paginated entries per day
- `dateFilter` — date-input filter over the day list
- `selectedDays: Set<string>` — checkbox selection used by "Download"
- `downloading` — which day (or `"all"`) is currently exporting
- `leftPct` — divider position, synced to `localStorage`

**History panel features:**
- Header: date filter, CLEAR button, Download button (downloads selected days if any are checked; otherwise downloads the filter result or all days)
- Select-all checkbox and per-day checkboxes appear when the day list is non-empty
- Per-day per-row: down-arrow accordion, formatted date, entry count, per-day CSV Download button
- Expanding a day fetches the first 100 entries; a "load more" cursor-paginates the rest. Entries inside an expanded day are grouped by `session`.

**Live feed panel features:**
- Renders `rawMessages` from `useTelemetry` with resolved CAN IDs and signal names
- Auto-scrolls to the bottom when the user is already near the bottom (40 px threshold); otherwise stays put

**Export format:**
- CSV (pivoted: `timestamp` column + one column per signal, using `frame_name ?? 0x<can_id>` as the header)
- Pages through `fetchLogs` with `limit=500` and the cursor until exhausted, then builds and downloads a single `Blob`

**API calls:** `fetchLogDays()`, `fetchLogs({ date, limit, before? })`.

---

## DevicePage

**Purpose:** Device settings tab. Shows the linked Device ID (with copy-to-clipboard), the Pi's online/offline indicator, and a team-members list editor (add / remove emails, Save button with dirty tracking).

**Location:** `src/components/DevicePage.tsx`

**Local state:** `device`, `loadState` (`loading` | `loaded` | `no_device` | `error`), `members`, `newEmail`, `saving`, `status`, `copied`, `dirty`.

**API calls:**
- `GET /api/device` on mount
- `POST /api/device/team-members` on Save (body: `{ team_members: string[] }`)

**Notes:**
- If the request returns 403 (caught as `DeviceNotRegisteredError` by `authFetch`), the page renders a "No Device Linked" help screen instructing the user to be added via the captive portal.
- Loading uses its own shimmer layout rather than the global `EditorSkeleton`.

---

## EditorSkeleton

**Purpose:** Full-screen shimmer layout shown during initial auth/data load in `AppWithAuth`. The `useDeferredSkeleton(active)` hook enforces a 150 ms "don't flash" delay and a 300 ms minimum visible duration once shown.

**Location:** `src/components/EditorSkeleton.tsx`

**Exports:** `EditorSkeleton` (default) and `useDeferredSkeleton`.
