# T.R.A.C.K. — Expected API Endpoints

**Disclaimer:** Tbh this was drafted in a hurry, keep in mind current context on our architecture when reading this to adapt to our needs.
**Audience:** Backend engineer, Cloud Engineer
**Purpose:** Complete reference of every HTTP and real-time endpoint the frontend requires, including request/response shapes, current mock state, and implementation priority.

All HTTP requests are relative (no domain). The Vite dev server proxies `/api/*` to `http://localhost:3000`. All request bodies and responses are JSON unless noted.

---

## System Architecture

Before reading the endpoint specs, understand how the three layers relate to each other.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLOUD / DB                           │
│  - Stores user accounts                                     │
│  - Stores screen/widget layout configs                      │
│  - Stores CAN frame definitions                             │
│  - Stores historical telemetry & log data                   │
│  - Hardware UUIDs registered here by the Pi on boot        │
└────────────────────┬────────────────────────────────────────┘
                     │ reads/writes
┌────────────────────▼────────────────────────────────────────┐
│                     BACKEND (Express)                       │
│  - REST API consumed by the frontend                        │
│  - Authenticates users against DB                           │
│  - Serves/persists screen configs from DB                   │
│  - Maintains a WebSocket connection TO the hardware portal  │
│  - Forwards live CAN data from that WS TO the frontend WS   │
└──────────┬──────────────────────────────┬───────────────────┘
           │ REST + WS (browser)          │ WS (hardware portal)
┌──────────▼──────────┐        ┌──────────▼───────────────────┐
│   FRONTEND (React)  │        │   HARDWARE PORTAL (Pi)        │
│  - Dashboard editor │        │  - Generates UUID on boot     │
│  - Live telemetry   │        │  - Registers UUID with DB     │
│  - Log terminal     │        │  - Streams CAN data via WS    │
└─────────────────────┘        └──────────────────────────────┘
```

### Key architectural rules

- **The frontend never talks directly to the hardware.** All hardware communication is backend-mediated.
- **The UUID is hardware-generated.** The Pi generates its UUID on boot and registers it directly with the DB. The backend reads it from the DB — it does not create it.
- **All live data flows through the backend WebSocket bridge.** The backend maintains a WS connection to the hardware portal and re-broadcasts that data to any connected frontend clients.
- **The cloud/DB is the source of truth for persistent data** — configs, layouts, user accounts, historical logs. The backend reads from and writes to it; the frontend never touches the DB directly.
- **`config/graphics.json` and `config/default.json`** are local to the Pi and written by the backend when the Pi is connected. Changes are pushed down the hardware WS channel and trigger SIGHUP on the embedded processes.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Hardware / Pi Connection](#2-hardware--pi-connection)
3. [Screen & Widget Layout](#3-screen--widget-layout)
4. [CAN Frame Parser Config](#4-can-frame-parser-config)
5. [DBC File Upload](#5-dbc-file-upload)
6. [Driver Display](#6-driver-display)
7. [Live Telemetry](#7-live-telemetry)
8. [Log Terminal](#8-log-terminal)
9. [Shared Types Reference](#9-shared-types-reference)
10. [Implementation Status Summary](#10-implementation-status-summary)

---

## 1. Authentication

> **Current state:** Entirely mocked. Clicking "Sign in with Google" sets a local boolean — no network call is made.

### 1.1 Google OAuth Login

The frontend sends the Google ID token it receives from the Google OAuth client. The backend validates it against Google's public keys, looks up or creates the user in the DB, and returns a session token.

```
POST /api/auth/google
```

**Request body**
```json
{
  "idToken": "string"   // Google ID token from the OAuth client SDK
}
```

**Response `200`**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string"
  },
  "token": "string"     // JWT — frontend stores this and sends it as Authorization: Bearer <token> on every subsequent request
}
```

**Response `401`**
```json
{ "error": "Invalid token" }
```

---

### 1.2 Logout

```
POST /api/auth/logout
```

**Request body** — none
**Response `200`** — none

Invalidates the session server-side. Frontend discards the stored token and returns to the landing page.

---

### 1.3 Session Check

Called on app load to determine whether a stored token is still valid, avoiding a full re-login on page refresh.

```
GET /api/auth/me
```

**Response `200`**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string"
  }
}
```

**Response `401`** — token missing or expired. Frontend redirects to landing page.

---

## 2. Hardware / Pi Connection

> **Current state:** "Connect to Pi" modal stores a UUID in local state and sets `hardwareOnline = true` with no network call. The navbar hardware pill reads from that local boolean.

### How UUID pairing works

1. The Pi boots and generates (or reads its persisted) UUID.
2. The Pi registers that UUID directly with the cloud DB.
3. The engineer copies the UUID from the Pi's display or boot log.
4. The engineer enters the UUID in the frontend "Connect to Pi" modal.
5. The frontend sends the UUID to the backend.
6. The backend looks up the UUID in the DB to confirm it exists and is registered.
7. The backend establishes (or confirms) its WebSocket connection to that Pi's hardware portal.
8. The backend responds to the frontend with current connection status.

The frontend never contacts the Pi directly. The backend is the only entity that holds the hardware WS connection.

---

### 2.1 Connect to Pi

```
POST /api/pi/connect
```

**Request body**
```json
{
  "uuid": "string"    // UUID entered by the user, e.g. "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Response `200`** — UUID found in DB and hardware portal is reachable
```json
{
  "online": true,
  "uuid": "string",
  "hostname": "string",   // e.g. "track-pi-01" — as registered by the Pi
  "lastSeen": "ISO8601 timestamp"
}
```

**Response `404`** — UUID not found in DB (Pi has never registered)
```json
{ "error": "UUID not registered" }
```

**Response `200` with `online: false`** — UUID is in DB but hardware portal is not currently connected
```json
{
  "online": false,
  "uuid": "string",
  "lastSeen": "ISO8601 timestamp"
}
```

---

### 2.2 Hardware Status

Polled by the frontend to keep the navbar pill current. Reflects the backend's live WS connection status to the hardware portal — not a direct ping to the Pi.

```
GET /api/pi/status
```

**Response `200`**
```json
{
  "online": true | false,
  "uuid": "string | null",
  "lastSeen": "ISO8601 timestamp | null"
}
```

Frontend polls this every 5 seconds once a UUID has been entered.

---

## 3. Screen & Widget Layout

> **Current state:** All four of these endpoints are already wired in the frontend via `frontend/src/utils/layoutIO.ts`. Configs are currently written to disk on the backend server. Once the cloud DB is available, the backend should persist them there instead and push the active config down to the connected Pi over the hardware WS channel.

The grid is **10 columns × 6 rows**, each cell **80 × 80 px** (800 × 480 display target).

---

### 3.1 List Saved Screens

```
GET /api/graphics/screens
```

**Response `200`**
```json
{
  "screens": ["Screen 1", "Race Day", "Endurance"]
}
```

Returns the names of all screens saved for this user. Used to populate the "Load Screen" dropdown in the sidebar.

---

### 3.2 Load a Screen

```
GET /api/graphics/screens/:name
```

**Response `200`** — `ScreenPayload` (see §3.5)

**Response `404`**
```json
{ "error": "Screen not found" }
```

---

### 3.3 Save / Overwrite a Screen

```
POST /api/graphics/screens/:name
```

**Request body** — `ScreenPayload` (see §3.5)

**Response `200`** — none

Backend should:
1. Persist to DB.
2. If a Pi is currently connected, push the updated config down the hardware WS channel.
3. Trigger SIGHUP on `graphics-engine` via the hardware portal.

---

### 3.4 Delete a Screen

```
DELETE /api/graphics/screens/:name
```

**Response `200`** — none
**Response `404`** — screen not found

---

### 3.5 ScreenPayload shape

Exact JSON sent on save and received on load.

```json
{
  "name": "Screen 1",
  "widgets": [
    {
      "type": "gauge",
      "alarm": false,
      "position": {
        "x": 0,
        "y": 0,
        "width": 2,
        "height": 2
      },
      "data": {
        "can_id": 256,
        "can_id_label": "MOTOR_DATA",
        "signal": "RPM",
        "unit": "rpm",
        "min": 0,
        "max": 8000,
        "caution_threshold": 7000,
        "critical_threshold": 7500
      }
    }
  ]
}
```

**Field notes**

| Field | Type | Notes |
|---|---|---|
| `type` | `"gauge" \| "number" \| "bar" \| "graph" \| "indicator"` | Widget variant |
| `alarm` | `boolean` | Whether alarm/flash is enabled |
| `position.x` | `number` | 0-based column (0–9) |
| `position.y` | `number` | 0-based row (0–5) |
| `position.width` | `number` | Span in columns |
| `position.height` | `number` | Span in rows |
| `data.can_id` | `number` | Decimal integer (e.g. `256` = `0x100`) |
| `data.can_id_label` | `string` | Human label for the CAN frame |
| `data.signal` | `string` | Signal name within that frame |
| `data.unit` | `"temperature" \| "pressure" \| "rpm"` | Display unit type |
| `data.min` / `data.max` | `number` | Widget scale range |
| `data.caution_threshold` | `number` | Amber warning line value |
| `data.critical_threshold` | `number` | Red critical line value |

---

## 4. CAN Frame Parser Config

> **Current state:** `GET /api/frame-parser` is called on app mount and stored in editor state. `POST /api/frame-parser` code exists in `layoutIO.ts` but is not yet wired to a UI action. These configs should ultimately live in the cloud DB, keyed by user/team, and be pushed down to the Pi when it connects.

### 4.1 Get Full Frame Config

Called once when the editor loads. Populates the CAN ID selector in the widget config panel.

```
GET /api/frame-parser
```

**Response `200`**
```json
{
  "frames": {
    "0x100": {
      "can_id_label": "MOTOR_DATA",
      "signals": [
        {
          "name": "RPM",
          "start_byte": 0,
          "length": 2,
          "type": "uint16",
          "scale": 1.0,
          "offset": 0.0
        },
        {
          "name": "TEMP",
          "start_byte": 2,
          "length": 1,
          "type": "uint8",
          "scale": 1.0,
          "offset": 0.0
        }
      ]
    }
  }
}
```

**Response `404`** — no config exists yet. Frontend treats as empty.

---

### 4.2 Add / Update a CAN Frame Definition

```
POST /api/frame-parser
```

**Request body**
```json
{
  "can_id": "0x100",
  "frameDefinition": {
    "can_id_label": "MOTOR_DATA",
    "signals": [
      {
        "name": "RPM",
        "start_byte": 0,
        "length": 2,
        "type": "uint16",
        "scale": 1.0,
        "offset": 0.0
      }
    ]
  }
}
```

**Response `200`** — none

Backend persists to DB and, if a Pi is connected, pushes the updated `config/default.json` down the hardware WS channel and triggers SIGHUP on `can-reader`.

---

### 4.3 Signal types

| Value | Description |
|---|---|
| `"uint8"` | Unsigned 8-bit integer |
| `"int8"` | Signed 8-bit integer |
| `"uint16"` | Unsigned 16-bit integer |
| `"int16"` | Signed 16-bit integer |
| `"uint32"` | Unsigned 32-bit integer |
| `"int32"` | Signed 32-bit integer |
| `"float"` | 32-bit IEEE 754 float |
| `"double"` | 64-bit IEEE 754 double |

---

## 5. DBC File Upload

> **Current state:** Wired and called. Frontend reads the file as a UTF-8 string and POSTs it. No response body is consumed — the frontend only shows the uploaded filename in the UI.

```
POST /api/dbc
```

**Request body**
```json
{
  "content": "string"   // raw .dbc file content as a UTF-8 string
}
```

**Response `200`** — none (frontend only shows the uploaded filename)

**Expected backend behaviour:**
1. Parse the DBC file and extract CAN frame/signal definitions.
2. Merge into the frame parser config in the DB.
3. If a Pi is connected, push the updated `config/default.json` down the hardware WS channel and trigger SIGHUP on `can-reader`.

**Suggested enhanced response** — lets the frontend refresh its CAN dropdown without a second round-trip:
```json
{
  "frames": { ... }   // same shape as GET /api/frame-parser response
}
```

---

## 6. Driver Display

> **Current state:** The selected driver display screen name is tracked locally with a dirty flag. It is bundled into the save action but the backend contract is not finalised.

### 6.1 Set Active Driver Display Screen

```
POST /api/driver-display
```

**Request body**
```json
{
  "screenName": "Race Day"   // or null to clear
}
```

**Response `200`** — none

Backend should:
1. Persist the selection to DB.
2. If a Pi is connected, push the updated `config/graphics.json` down the hardware WS channel and trigger SIGHUP on `graphics-engine`.

---

### 6.2 Get Active Driver Display Screen

```
GET /api/driver-display
```

**Response `200`**
```json
{
  "screenName": "Race Day"   // or null
}
```

---

## 7. Live Telemetry

> **Current state:** Entirely mocked. `TelemetryPage.tsx` uses hardcoded 30-sample arrays for 10 signals plus static GPS, G-force, and lap time values. Nothing is fetched.

### Data flow

```
Pi CAN bus → can-reader → shared memory → data-logger → hardware WS portal
                                                               │
                                                        Backend WS bridge
                                                               │
                                                      Frontend WS client
                                                               │
                                                      TelemetryPage renders
```

The backend maintains a persistent WebSocket connection to the hardware portal. When the frontend opens its telemetry WebSocket, the backend begins forwarding the live CAN data stream it receives from the Pi.

Historical session data (for post-race analysis) is written to the cloud DB by the backend as it arrives.

---

### Signals the frontend expects

| Signal key | Label | Unit | Approx range | Suggested update rate |
|---|---|---|---|---|
| `rpm` | Motor RPM | rpm | 0 – 8000 | ~20 Hz |
| `spd` | Vehicle speed | km/h | 0 – 160 | ~20 Hz |
| `thr` | Throttle position | % | 0 – 100 | ~20 Hz |
| `brk` | Brake pressure | bar | 0 – 80 | ~20 Hz |
| `mtmp` | Motor temperature | °C | 0 – 120 | ~5 Hz |
| `itmp` | Inverter temperature | °C | 0 – 100 | ~5 Hz |
| `pvolt` | Pack voltage | V | 380 – 400 | ~10 Hz |
| `soc` | State of charge | % | 0 – 100 | ~1 Hz |
| `latg` | Lateral G | g | –3 – +3 | ~20 Hz |
| `long` | Longitudinal G | g | –2 – +2 | ~20 Hz |

---

### 7.1 Frontend WebSocket

```
WS /api/telemetry/live
```

**Server → client message** (sent on each update cycle)
```json
{
  "ts": 1710000000123,
  "signals": {
    "rpm":   6420,
    "spd":   98,
    "thr":   87,
    "brk":   34,
    "mtmp":  72,
    "itmp":  68,
    "pvolt": 392.4,
    "soc":   73,
    "latg":  1.8,
    "long":  -0.4
  },
  "gps": {
    "lat": 29.7604,
    "lon": -95.3698,
    "lock": true
  },
  "lap": {
    "current": 84.3,
    "sectors": [28.1, 31.4, 24.8],
    "best": 82.9
  }
}
```

Not all fields need to be present on every message. The frontend will hold the last known value for any missing field.

---

### 7.2 Snapshot fallback (if WebSocket is not ready yet)

```
GET /api/telemetry/snapshot
```

**Response `200`** — same shape as the WebSocket message above.

---

## 8. Log Terminal

> **Current state:** Entirely mocked. `LogTerminalPage.tsx` renders 20 hardcoded CAN log lines. Nothing is fetched.

### Data flow

Same pipeline as telemetry — the backend receives raw CAN frame events from the hardware portal WS, writes them to the cloud DB for history, and forwards them live to the frontend WS.

---

### 8.1 Frontend WebSocket

```
WS /api/logs/live
```

**Server → client message** — one entry per CAN frame received
```json
{
  "ts": "12:34:01.023",
  "can_id": "0x200",
  "label": "MOTOR_DATA",
  "signals": {
    "RPM": 6420,
    "TEMP": 72,
    "TORQUE": 186
  },
  "raw": "[12:34:01.023] 0x200 | MOTOR_DATA → RPM=6420 TEMP=72°C TORQUE=186Nm"
}
```

The frontend currently renders the `raw` string. The structured `signals` object is included so the frontend can later do per-field colour coding without a protocol change.

---

### 8.2 Log history (from DB)

Used to pre-populate the terminal on page load with recent entries before the live stream catches up.

```
GET /api/logs/history?limit=100&before=<unix_ms_timestamp>
```

**Response `200`**
```json
{
  "entries": [
    {
      "ts": "12:34:01.023",
      "can_id": "0x200",
      "label": "MOTOR_DATA",
      "signals": { "RPM": 6420, "TEMP": 72, "TORQUE": 186 },
      "raw": "..."
    }
  ]
}
```

---

## 9. Shared Types Reference

All TypeScript types live in `frontend/src/types.ts`.

### WidgetType
```typescript
type WidgetType = "gauge" | "number" | "bar" | "graph" | "indicator";
```

### DataFieldType (display unit)
```typescript
type DataFieldType = "temperature" | "pressure" | "rpm";
```

### SignalType (CAN signal encoding)
```typescript
type SignalType =
  | "uint8" | "int8"
  | "uint16" | "int16"
  | "uint32" | "int32"
  | "float" | "double";
```

### PlacedWidget (frontend internal)
```typescript
interface PlacedWidget {
  id: string;                        // UUID (frontend-generated)
  type: WidgetType;
  col: number;                       // 0-based, 0–9
  row: number;                       // 0-based, 0–5
  cols: number;                      // width in cells
  rows: number;                      // height in cells
  alarm?: boolean;
  widgetCanId?: string;              // hex string e.g. "0x100"
  widgetSignal?: string;
  widgetUnit?: DataFieldType;
  widgetMin?: number;
  widgetMax?: number;
  widgetCautionThreshold?: number;
  widgetCriticalThreshold?: number;
}
```

### FrameDefinition
```typescript
interface FrameDefinition {
  can_id_label: string;
  signals: FrameSignal[];
}
```

### FrameSignal
```typescript
interface FrameSignal {
  name: string;
  start_byte: number;      // 0–7
  length: number;          // byte count
  type: SignalType;
  scale: number;
  offset: number;
}
```

### FrameParserConfig
```typescript
type FrameParserConfig = Record<string, FrameDefinition>;
// Key: hex string e.g. "0x100"
```

---

## 10. Implementation Status Summary

| # | Endpoint | Method | Status | Priority |
|---|---|---|---|---|
| 1 | `/api/auth/google` | POST | Not implemented | High |
| 2 | `/api/auth/logout` | POST | Not implemented | High |
| 3 | `/api/auth/me` | GET | Not implemented | Medium |
| 4 | `/api/pi/connect` | POST | Not implemented | High |
| 5 | `/api/pi/status` | GET | Not implemented | High |
| 6 | `/api/graphics/screens` | GET | **Implemented** | — |
| 7 | `/api/graphics/screens/:name` | GET | **Implemented** | — |
| 8 | `/api/graphics/screens/:name` | POST | **Implemented** | — |
| 9 | `/api/graphics/screens/:name` | DELETE | **Implemented** | — |
| 10 | `/api/frame-parser` | GET | **Implemented** | — |
| 11 | `/api/frame-parser` | POST | Partial — code ready, no UI trigger | Medium |
| 12 | `/api/dbc` | POST | **Implemented** | — |
| 13 | `/api/driver-display` | POST | Not implemented | Medium |
| 14 | `/api/driver-display` | GET | Not implemented | Medium |
| 15 | `WS /api/telemetry/live` | WebSocket | Not implemented | High |
| 16 | `/api/telemetry/snapshot` | GET (fallback) | Not implemented | Medium |
| 17 | `WS /api/logs/live` | WebSocket | Not implemented | High |
| 18 | `/api/logs/history` | GET | Not implemented | Low |
