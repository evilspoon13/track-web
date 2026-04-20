# Data Flow Diagrams

These diagrams show how data moves through the system — state mutations, API interactions, WebSocket streams, cross-tab sync, and CSV export.

---

## 1. Initial Data Load

When `EditorProvider` mounts, it fetches the DBC, every saved screen, and the user's screen prefs in parallel. Once both screens and prefs have arrived it dispatches `CLEANUP_STALE_PREFS` to drop pinned/ordered names that no longer map to a live screen.

```mermaid
sequenceDiagram
    participant EP as EditorProvider
    participant IO as layoutIO.ts
    participant API as Backend API
    participant FS as Firebase Firestore

    par DBC
        EP->>IO: getDbc()
        IO->>API: GET /api/dbc
        API->>FS: read devices/{deviceId}/dbc/content
        FS-->>API: raw + parsed frames
        API-->>IO: { frames: FrameParserConfig }
        IO-->>EP: FrameParserConfig
        EP->>EP: dispatch SET_FRAME_PARSER_CONFIG
    and Screens
        EP->>IO: listScreens()
        IO->>API: GET /api/graphics/screens
        API-->>IO: { screens: string[] }
        IO-->>EP: names
        EP->>IO: Promise.all(names.map(loadScreen))
        IO->>API: GET /api/graphics/screens/{name} (× N)
        API-->>IO: BackendScreenInfo (× N)
        IO-->>EP: SavedLayout[]
        EP->>EP: dispatch LOAD_ALL_SCREENS
    and Prefs
        EP->>IO: getScreenPrefs()
        IO->>API: GET /api/prefs/screens
        API->>FS: read users/{uid}/prefs/screens
        FS-->>API: { pinnedNames, order }
        API-->>IO: ScreenPrefs
        IO-->>EP: ScreenPrefs
        EP->>EP: dispatch SET_SCREEN_PREFS
    end

    Note over EP: Once screens + prefs both settled,<br/>dispatch CLEANUP_STALE_PREFS
```

If `listScreens()` throws `DeviceNotRegisteredError` (HTTP 403), `AppWithAuth` routes to the "No Device Linked" screen instead of mounting `EditorProvider`.

---

## 2. State Mutation Pipeline

Every user action that changes editor state follows this path. No component mutates state directly.

```mermaid
flowchart LR
    C["Component<br/>(e.g. ConfigPanel)"] -->|dispatch action| R[editorReducer]
    R -->|returns new EditorState| CTX["EditorContext<br/>state value updated"]
    CTX -->|re-render| C
    CTX -->|re-render| C2["Other subscribers<br/>(ScreenTabs, Navbar)"]
```

**Action lifecycle example — editing a widget's CAN ID:**

```mermaid
sequenceDiagram
    participant U as User
    participant CP as ConfigPanel
    participant D as dispatch
    participant R as editorReducer
    participant CTX as EditorContext

    U->>CP: selects new CAN ID from dropdown
    CP->>D: UPDATE_WIDGET_DATA { id, widgetCanId: "0x123" }
    D->>R: reducer called with current state + action
    R->>R: finds widget by id in activeScreen.widgets
    R->>R: merges widgetCanId update
    R->>R: sets screen.isDirty = true
    R-->>CTX: returns new EditorState
    CTX-->>CP: ConfigPanel re-renders with new value
    CTX-->>Navbar: Save button shows teal dot
    CTX-->>ScreenTabs: Tab shows teal dot
```

---

## 3. Save Sequence

Clicking Save in `Navbar` saves **every dirty screen** in parallel, then the DBC if `canIdsDirty`. Each screen POST triggers a backend-side cross-tab broadcast and a live `config_update` push to the Pi.

```mermaid
sequenceDiagram
    participant NB as Navbar
    participant IO as layoutIO.ts
    participant API as Backend API
    participant FS as Firebase Firestore
    participant WS as broadcastToDeviceClients
    participant PI as Pi (cloud-bridge)

    NB->>NB: user confirms save modal
    NB->>NB: targets = dirtyScreens (or [activeScreen])

    par for each dirty screen
        NB->>IO: saveScreen(screen, fpc)
        IO->>IO: widgetToBackend() converts widgets
        IO->>API: POST /api/graphics/screens/{name}
        API->>FS: write devices/{deviceId}/screens/{name}
        API->>WS: broadcast screen_updated → other tabs
        API->>PI: pushFullConfigToPi → /ws/pi { type: "config_update", payload }
        Note over API,PI: Fire-and-forget. If Pi is offline,<br/>the change is lost until the next save.
        API-->>IO: { success: true }
    end

    NB->>dispatch: UPDATE_ORIGINAL_NAME + MARK_CLEAN per screen

    alt canIdsDirty
        NB->>IO: saveDbc(fpc)
        IO->>API: POST /api/dbc
        API->>FS: write dbc/content
        API-->>IO: ok
        NB->>dispatch: MARK_CAN_IDS_CLEAN
    end

    NB->>NB: "Saved!" toast (2s)
```

Screen prefs are **not** part of this flow — they auto-save on a separate 400 ms debounce (see §7). DBC saves do not push to the Pi (the Pi uploads its own DBC via `dbc_upload` on the captive-portal path).

---

## 4. Live Telemetry Flow

`TelemetryProvider` owns the `/ws/client` connection. `TelemetryPage`, `MapPage`, and the log terminal's live feed all read from it via `useTelemetry()`. In addition to `Telemetry` frames, the provider also handles `gps` frames — each incoming point updates `latestGps` and appends to `gpsSession`, which `MapPage` reads to draw the live track.

```mermaid
sequenceDiagram
    participant TP as TelemetryProvider
    participant WS as WebSocket /ws/client
    participant BE as Backend
    participant PI as Pi (can-reader)
    participant FB as Firebase Auth

    TP->>WS: new WebSocket(/ws/client)
    WS-->>TP: open
    TP->>FB: getIdToken()
    FB-->>TP: token
    TP->>WS: { type: "auth", token, client_id: uid }
    WS->>BE: verifyIdToken + resolve deviceId
    BE-->>WS: connection tagged { uid, deviceId }

    loop CAN data arriving on Pi
        PI->>BE: telemetry frame via /ws/pi
        BE->>WS: { type: "Telemetry", device_id, payload: { signals } } (fan-out to matching deviceId)
        WS-->>TP: message event
        TP->>TP: append to signals ring buffer (30 values/signal)
        TP->>TP: enqueue rawMessages (flushed every 50 ms, capped at 500)
    end

    alt socket closes
        WS-->>TP: close
        TP->>TP: setTimeout(connect, 1000)
    end
```

**Per-signal rendering logic (`TelemetryPage`):**

```mermaid
flowchart TD
    A[signalHistory Map updates] --> B[TelemetryPage re-renders]
    B --> C[auto-tile grid: 1/2/3 columns by signal count]
    C --> D[per-signal GraphCard:<br/>SVG polyline + area fill,<br/>4 Y-axis ticks,<br/>hover crosshair + tooltip]
```

There is no longer a per-widget-type SmartSignalCard. Every live signal renders as a line graph regardless of how the editor's widget is configured.

---

## 5. Cross-Tab Sync

When one browser tab saves, deletes, or re-prefs a screen, every other tab on the **same user account** updates in place — no reload, no poll. The backend broadcasts via `/ws/client` and `TelemetryProvider` demultiplexes the events into editor dispatches.

```mermaid
sequenceDiagram
    participant T1 as Tab 1 (writer)
    participant API as Backend API
    participant RT as realtime.service
    participant T2 as Tab 2 (listener)
    participant ER as editorReducer

    T1->>API: POST /api/graphics/screens/{name}
    API->>API: graphicsService.saveScreen()
    API->>RT: broadcastToDeviceClients(deviceId,<br/>{ type: "screen_updated", name, screen })
    RT-->>T2: WSS message
    T2->>T2: TelemetryProvider.onmessage
    T2->>ER: UPSERT_SCREEN { name, widgets }
    ER->>ER: if existing & isDirty → no-op<br/>else replace/insert + originalName = name

    Note over T1,T2: Same mechanism for DELETE (screen_deleted → REMOVE_SCREEN_BY_NAME)<br/>and prefs PUT (screen_prefs_updated → SET_SCREEN_PREFS)
```

**Safety rule:** `UPSERT_SCREEN` is a no-op against a locally dirty screen — incoming broadcasts never clobber in-progress edits.

---

## 6. Log Viewer Flow

### 6a. History Panel

On mount, day summaries are fetched. The user expands a day to load its first page of entries, then paginates with a cursor.

```mermaid
sequenceDiagram
    participant LT as LogTerminalPage
    participant API as Backend API /api/logs

    LT->>API: fetchLogDays()
    API-->>LT: DaySummary[] (date + count per day)
    LT->>LT: render day list with checkboxes

    Note over LT: user clicks a day row
    LT->>API: fetchLogs({ date, limit: 100 })
    API-->>LT: { entries: LogEntry[], nextCursor: number | null }
    LT->>LT: render entries grouped by session

    loop user clicks "load more"
        LT->>API: fetchLogs({ date, limit: 100, before: nextCursor })
        API-->>LT: { entries: older entries, nextCursor }
        LT->>LT: append to day's list
        alt nextCursor is null
            LT->>LT: hide "load more" button
        end
    end
```

### 6b. Live Feed Panel

The right panel streams live telemetry via the existing `useTelemetry()` hook and auto-scrolls to the bottom unless the user has scrolled up.

```mermaid
sequenceDiagram
    participant LT as LogTerminalPage
    participant TH as useTelemetry() hook
    participant WS as WebSocket /ws/client

    TH->>WS: subscribe (managed by TelemetryProvider)
    loop CAN data arriving
        WS-->>TH: Telemetry message
        TH->>TH: rawMessages flushed every 50 ms
        TH-->>LT: rawMessages array updated
        LT->>LT: render lines (resolve CAN ID → frame name via frameParserConfig)
        alt user near bottom
            LT->>LT: auto-scroll
        end
    end
```

### 6c. CSV Export

Export pages through the target days (selected, filtered, or all), pivots every entry into a `timestamp × signal` grid, and writes a single CSV `Blob`.

```mermaid
sequenceDiagram
    participant LT as LogTerminalPage
    participant API as Backend API /api/logs

    Note over LT: user clicks per-day Download<br/>or global Download button

    alt per-day
        LT->>LT: targetDays = [clickedDay]
    else global
        LT->>LT: targetDays = selectedDays ?? filteredDays ?? days
    end

    loop each target day
        loop paginate until exhausted
            LT->>API: fetchLogs({ date, limit: 500, before: cursor })
            API-->>LT: { entries, nextCursor }
        end
    end

    LT->>LT: pivot entries into rows (timestamp × signal columns)
    LT->>LT: build CSV with csvEscape()
    LT->>LT: create Blob + anchor download
```

**LogEntry shape:**

```typescript
{
  ts: number           // Unix timestamp (ms)
  can_id: number       // integer CAN ID
  value: number        // decoded signal value
  session: string      // session identifier
  frame_name: string | null  // resolved from DBC, null if unknown
}
```

CSV headers are `timestamp, <signal-1>, <signal-2>, ...` where each signal column uses `frame_name ?? "0x<can_id>"` as its key. Timestamps are emitted as ISO strings.

---

## 7. Screen Prefs Auto-Save

Pin, unpin, drag-reorder, and rename all mark `prefsDirty = true`. A single effect in `EditorProvider` debounces the PUT and marks clean.

```mermaid
sequenceDiagram
    participant U as User
    participant ST as ScreenTabs
    participant ER as editorReducer
    participant EP as EditorProvider
    participant IO as layoutIO.ts
    participant API as Backend API
    participant RT as realtime.service
    participant T2 as Other Tabs

    U->>ST: pin / unpin / drag-reorder
    ST->>ER: TOGGLE_PIN_SCREEN or REORDER_SCREENS
    ER-->>EP: prefsDirty = true
    EP->>EP: setTimeout 400 ms

    EP->>IO: saveScreenPrefs({ pinnedNames, order })
    IO->>API: PUT /api/prefs/screens
    API->>FS: write users/{uid}/prefs/screens
    API->>RT: broadcastToUserClients(uid,<br/>{ type: "screen_prefs_updated", prefs })
    RT-->>T2: WSS message<br/>dispatch SET_SCREEN_PREFS
    API-->>IO: ok
    EP->>ER: MARK_PREFS_CLEAN

    alt PUT fails
        EP->>EP: keep prefsDirty = true<br/>(retries on next mutation)
    end
```

Any subsequent mutation within the 400 ms window resets the timer — the PUT only fires once the user pauses.
