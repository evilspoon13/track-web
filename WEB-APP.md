# T.R.A.C.K. — Web App

Telemetry Rendering And Capture Kit — web configurator for building and managing FSAE race-day display layouts, viewing live telemetry, browsing log history, and managing device team-member access.

---

## Overview

```
track-web/
  frontend/        React 18 + Vite + TypeScript — dashboard configurator UI
  backend/         Express 5 + TypeScript — REST API + WebSocket gateway
  documentation/   frontend-focused docs + mermaid PNGs
  docker-compose.yml
  Dockerfile.emulator
```

The frontend is a drag-and-drop dashboard editor split across four pages: **Screen Editor**, **Live Telemetry**, **Log Terminal**, and **Device**. The backend persists everything to Firestore, broadcasts writes to every open client tab, and pushes the full screen set to the on-car Pi over a versioned sync protocol.

---

## Tech stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Frontend    | React 18, Vite 6, TypeScript, Tailwind CSS 3      |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable + modifiers     |
| Backend     | Express 5, TypeScript, Node.js 20                 |
| Auth        | Firebase Auth (Google provider)                   |
| Database    | Firestore (top-level `users`, `devices`)          |
| Realtime    | `ws` WebSocket server (`/ws/pi`, `/ws/client`)    |
| DBC parsing | `candied`                                         |
| Container   | Docker + Docker Compose + nginx                   |

---

## Environment variables

```bash
cp .env.example .env
```

| Variable | Used by | Notes |
|---|---|---|
| `VITE_FIREBASE_*` | Frontend | Baked in at build time. From Firebase Console → Project Settings → SDK snippet. |
| `FIREBASE_PROJECT_ID` | Backend | Always required. |
| `FIREBASE_CLIENT_EMAIL` | Backend | Service account — from Firebase Console → Service Accounts. |
| `FIREBASE_PRIVATE_KEY` | Backend | Service account private key. |
| `VITE_AUTH_ENABLED` | Frontend | Set to `false` to skip login (UI-only dev). Docker hardcodes this to `true`. |
| `DEVICE_SECRET` | Backend | Shared secret required on `/ws/pi` via `x-device-secret` header, and on `/api/devices` REST routes. Leave empty for local dev. |
| `PORT` | Backend | Defaults to `3000`. |

Docker compose overrides emulator networking automatically. Production should never have emulator vars set.

---

## Running locally — npm

Three terminals, hot reload on all services.

**Terminal 1 — Firebase emulator** (from `track-web/`):
```bash
firebase emulators:start
```
Firestore: `localhost:8080` · Auth: `localhost:9099` · UI: `localhost:4000`

**Terminal 2 — Backend** (from `track-web/backend/`):
```bash
npm run dev
```
Runs on `localhost:3000`. Emulator hosts are set automatically via the dev script.

**Terminal 3 — Frontend** (from `track-web/frontend/`):
```bash
npm run dev
```
Runs on `localhost:5173`. To use the Firebase emulators, set `VITE_USE_EMULATOR=true` in `.env`.

> To work on UI only (no backend or emulator needed), set `VITE_AUTH_ENABLED=false` in `.env`.

---

## Running locally — Docker

Single command, production build served by nginx, emulator included.

```bash
# From track-web/
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | `http://localhost` |
| Backend | `http://localhost:3000` |
| Emulator UI | `http://localhost:4000` |

Emulator state is ephemeral — resets on each `docker compose up`. Stop with `docker compose down`.

---

## Deployment

| App | Fly app name | Method |
|-----|-------------|--------|
| Backend | `track-web` | Auto-deploys on push to `main` via Fly GitHub integration |
| Frontend | `track-web-frontend` | Manual: `cd frontend && fly deploy` |

---

## API surface

All `/api/*` routes require a Firebase ID token in `Authorization: Bearer <token>` unless otherwise noted. Most also require a linked device (returns 403 `Device not registered` if not) — the exception is `/api/prefs`, which is user-scoped.

### Graphics
| Method | Path | Notes |
|---|---|---|
| GET | `/api/graphics/screens` | List screen names |
| GET | `/api/graphics/screens/:screenId` | Get a single screen config |
| POST | `/api/graphics/screens/:screenId` | Upsert a screen — broadcasts `screen_updated` to siblings and commits to the sync store |
| DELETE | `/api/graphics/screens/:screenId` | Delete a screen — broadcasts `screen_deleted` and commits |

### DBC
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dbc` | Parsed CAN frame definitions |
| POST | `/api/dbc` | Write frame definitions (JSON) |
| POST | `/api/dbc/upload` | Parse raw `.dbc` text → store + return `FrameParserConfig` |

### Prefs (user-scoped)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/prefs/screens` | `{ pinnedNames, order }` |
| PUT | `/api/prefs/screens` | Write + broadcast `screen_prefs_updated` to all of this user's tabs |

### Logs
| Method | Path | Notes |
|---|---|---|
| GET | `/api/logs/days` | List log days with per-day entry counts |
| GET | `/api/logs?date=&limit=&before=` | Paginated entries, newest-first |

### Device
| Method | Path | Notes |
|---|---|---|
| GET | `/api/device` | Current user's linked device info |
| POST | `/api/device/team-members` | Update team-member email list |

### Device registration (device-secret auth)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/devices/register` | Pi-side registration via `x-device-secret` header |

---

## WebSocket channels

| Path | Auth | Purpose |
|---|---|---|
| `/ws/pi` | `x-device-id` + `x-device-secret` headers | Pi heartbeat, telemetry, log upload, and sync protocol |
| `/ws/client` | `{ type: "auth", token, client_id }` message after `open` | Browser: live telemetry + cross-tab editor events |

### Events fanned out on `/ws/client`

| `type` | When | Matching |
|---|---|---|
| `Telemetry` | Pi pushes a telemetry frame | All clients with the same `deviceId` |
| `screen_updated` | Any client POSTs `/api/graphics/screens/:name` | Same `deviceId` |
| `screen_deleted` | Any client DELETEs `/api/graphics/screens/:name` | Same `deviceId` |
| `screen_prefs_updated` | Any client PUTs `/api/prefs/screens` | Same `uid` |

Multiple concurrent connections per user are supported — `TelemetryProvider` in the frontend reconnects automatically with a 1 s backoff and re-sends the `auth` message on each reconnect.

---

## Firestore data model

```
users/
  {uid}
    device_id, email, displayName, createdAt
    prefs/screens           # per-user pin + order

devices/
  {deviceId}
    device_id, teamMembers[], memberUids[], connected, lastSeen, updatedAt

    screens/{name}          # dashboard layouts
    dbc/content             # raw .dbc text
    logs/{chunkId}          # 30k-entry chunks
    files/{fileId}          # versioned sync store (graphics, display_dbc)
```

Every screen write also commits to `devices/{deviceId}/files/graphics` via `SyncService.commitCloudGeneratedGraphics`, producing the `sync_download` message the Pi consumes on reconnect. See `documentation/data-model.md` for the full field-level schema.

---

## Further reading

- `documentation/README.md` — frontend documentation index
- `documentation/architecture.md` — frontend tech stack, state shape, action catalog
- `documentation/data-flows.md` — initial load, save, cross-tab sync, CSV export, prefs auto-save
- `documentation/user-flows.md` — auth, drag-drop, pin/reorder, bulk delete, DBC upload, device tab
- `backend/documentation/README.md` — backend module reference, realtime gateway, sync protocol
