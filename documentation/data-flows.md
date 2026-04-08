# Data Flow Diagrams

These diagrams show how data moves through the system — state mutations, API interactions, WebSocket streams, and pagination.

---

## 1. Initial Data Load

When `EditorProvider` mounts, it fetches the current CAN frame definitions and driver display setting from the backend in parallel before any user interaction.

```mermaid
sequenceDiagram
    participant EP as EditorProvider
    participant IO as layoutIO.ts
    participant API as Backend API
    participant FS as Firebase Firestore

    EP->>IO: Promise.all([getDbc(), getDriverDisplay()])
    IO->>API: GET /api/dbc
    IO->>API: GET /api/graphics/driver-display
    API->>FS: read device config
    FS-->>API: frames + driverDisplayScreen
    API-->>IO: { frames: FrameParserConfig }
    API-->>IO: { driverDisplayScreen: string | null }
    IO-->>EP: [FrameParserConfig, string | null]
    EP->>EP: dispatch SET_FRAME_PARSER_CONFIG
    EP->>EP: dispatch LOAD_DRIVER_DISPLAY
    Note over EP: EditorState updated,<br/>components re-render
```

---

## 2. State Mutation Pipeline

Every user action that changes editor state follows this path. No component mutates state directly.

```mermaid
flowchart LR
    C[Component\neg. ConfigPanel] -->|dispatch action| R[editorReducer]
    R -->|returns new EditorState| CTX[EditorContext\nstate value updated]
    CTX -->|re-render| C
    CTX -->|re-render| C2[Other subscribers\neg. ScreenTabs, Navbar]
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
    CTX-->>Navbar: Save button shows orange dot
    CTX-->>ScreenTabs: Tab shows orange dot
```

---

## 3. Save Sequence

Saving pushes the current state to the backend, which persists to Firestore and relays config to the Pi over WebSocket.

```mermaid
sequenceDiagram
    participant NB as Navbar
    participant IO as layoutIO.ts
    participant API as Backend API
    participant FS as Firebase Firestore
    participant PI as Pi (cloud-bridge)
    participant D as dispatch

    NB->>NB: user confirms save modal
    NB->>IO: saveScreen(screen, frameParserConfig)
    IO->>IO: widgetToBackend() converts each widget<br/>(col/row → x/y, hex CAN ID → int)
    IO->>API: POST /api/graphics/screens/{name}
    API->>FS: write screen config
    API->>PI: push layout via /ws/pi WebSocket
    PI->>PI: reload graphics-engine with new config
    API-->>IO: 200 OK
    IO-->>NB: resolved

    alt driverDisplayDirty
        NB->>IO: setDriverDisplay(screenName)
        IO->>API: POST /api/graphics/driver-display
        API->>FS: write driverDisplayScreen
        API-->>IO: 200 OK
    end

    alt canIdsDirty
        NB->>IO: saveDbc(frameParserConfig)
        IO->>API: POST /api/dbc
        API->>FS: write frame definitions
        API-->>IO: 200 OK
    end

    NB->>D: MARK_CLEAN, MARK_DRIVER_DISPLAY_CLEAN, MARK_CAN_IDS_CLEAN
    NB->>D: UPDATE_ORIGINAL_NAME (tracks backend copy for rename detection)
```

---

## 4. Live Telemetry Flow

`TelemetryPage` opens a WebSocket to the backend and renders live signal values using the driver display screen's widget configuration.

```mermaid
sequenceDiagram
    participant TP as TelemetryPage
    participant WS as WebSocket /ws/client
    participant BE as Backend
    participant PI as Pi (can-reader)
    participant FB as Firebase Auth

    TP->>FB: getIdToken()
    FB-->>TP: token
    TP->>WS: connect ws://{host}/ws/client
    TP->>WS: send { type: "auth", token }
    WS->>BE: authenticate connection
    BE-->>WS: connection accepted

    loop CAN data arriving on Pi
        PI->>BE: signal values via internal pipe
        BE->>WS: { type: "Telemetry", payload: { signals: { "signal_name": value } } }
        WS-->>TP: message event
        TP->>TP: update signalHistory map<br/>max 30 values per signal (ring buffer)
        TP->>TP: re-render SmartSignalCard components
    end

    Note over TP: Cards read driverDisplayScreen config<br/>from EditorState to determine<br/>which widget type to render per signal
```

**SmartSignalCard rendering logic:**

```mermaid
flowchart TD
    A[SmartSignalCard receives signal name + history] --> B[Look up widget config\nfrom driverDisplayScreen]
    B --> C{widget.type?}
    C -- gauge --> D[Circular gauge\nwith caution/critical arc]
    C -- bar --> E[Horizontal fill bar\ncolor-coded by threshold]
    C -- number --> F[Large numeric display\nwith unit label]
    C -- graph --> G[Scrolling line graph\nover last 30 values]
    C -- indicator --> H[Boolean dot\ngreen / yellow / red]
```

---

## 5. Log Viewer Flow

`LogTerminalPage` is a resizable split-panel: history (left) and live feed (right). The divider is draggable, and the split percentage is persisted in `localStorage` under `log-split-pct`.

### 5a. History Panel

On mount, day summaries are fetched. The user expands a day to load its entries, then clicks "load more" to paginate.

```mermaid
sequenceDiagram
    participant LT as LogTerminalPage
    participant API as Backend API /api/logs

    LT->>API: fetchLogDays()
    API-->>LT: DaySummary[] (date + count per day)
    LT->>LT: render day list with entry counts

    Note over LT: user clicks a day row
    LT->>API: fetchLogs({ date, limit: 100 })
    API-->>LT: { entries: LogEntry[], nextCursor: number | null }
    LT->>LT: render entries grouped by session

    loop user clicks "load more" button
        LT->>API: fetchLogs({ date, limit: 100, before: nextCursor })
        API-->>LT: { entries: older entries, nextCursor }
        LT->>LT: append older entries to day's list
        alt nextCursor is null
            LT->>LT: hide "load more" button (no more data)
        end
    end
```

### 5b. Live Feed Panel

The right panel streams live telemetry via the existing `useTelemetry()` hook and auto-scrolls to the bottom unless the user has scrolled up.

```mermaid
sequenceDiagram
    participant LT as LogTerminalPage
    participant TH as useTelemetry() hook
    participant WS as WebSocket /ws/client

    TH->>WS: subscribe (managed by TelemetryContext)
    loop CAN data arriving
        WS-->>TH: raw message { key, value, ts }
        TH-->>LT: rawMessages array updated
        LT->>LT: render new line with CAN ID, frame name, signal, value
        alt user has not scrolled up
            LT->>LT: auto-scroll to bottom
        end
    end
```

### 5c. XLSX Export

Export fetches all pages for the target day(s), pivots entries into a timestamp-by-signal grid, and writes an Excel file via the `xlsx` library.

```mermaid
sequenceDiagram
    participant LT as LogTerminalPage
    participant API as Backend API /api/logs
    participant XL as xlsx library

    Note over LT: user clicks "XLSX" (per-day) or "DOWNLOAD ALL"

    loop for each target day
        loop paginate until exhausted
            LT->>API: fetchLogs({ date, limit: 500, before: cursor })
            API-->>LT: { entries, nextCursor }
        end
    end

    LT->>XL: pivot entries into rows (timestamp × signal columns)
    XL-->>LT: write .xlsx file to disk
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
