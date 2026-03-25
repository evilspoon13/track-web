# T.R.A.C.K. — Web App

Telemetry Rendering And Capture Kit — web configurator for building and managing FSAE race-day display layouts.

---

## Overview

```
track-web/
  frontend/     React 18 + Vite + TypeScript — dashboard configurator UI
  backend/      Express 5 + TypeScript — config REST API
  docker-compose.yml
  Dockerfile.emulator
```

The frontend is a drag-and-drop dashboard editor. Users build screen layouts (widgets on a 10×6 grid) and save them. The backend exposes a REST API backed by Firestore. Firebase handles auth (Google sign-in) and Firestore stores all user config.

---

## Tech stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 18, Vite 6, TypeScript, Tailwind CSS 3  |
| Drag & drop | @dnd-kit/core                                 |
| Backend     | Express 5, TypeScript, Node.js 20             |
| Auth        | Firebase Auth (Google provider)               |
| Database    | Firestore (per-user subcollections)           |
| Container   | Docker + Docker Compose + nginx               |

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
| `PORT` | Backend | Defaults to `3000`. Change if port is taken. |

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
Runs on `localhost:5173`. Vite DEV mode auto-connects to the local emulators.

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

## Production — WIP

Target: frontend on Firebase Hosting / Vercel, backend on Cloud Run / Fly.io.

See `.claude/plans/production-prep.md` for the full checklist.

---

## API surface

All `/api/*` routes require `Authorization: Bearer <Firebase ID token>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/graphics/screens` | List screen names |
| GET | `/api/graphics/screens/:screenId` | Get a single screen config |
| POST | `/api/graphics/screens/:screenId` | Upsert a screen config |
| DELETE | `/api/graphics/screens/:screenId` | Delete a screen |
| GET | `/api/frame-parser` | Read CAN frame definitions |
| POST | `/api/frame-parser` | Upsert a frame definition |
| GET | `/api/dbc` | Read current DBC |
| POST | `/api/dbc` | Write new DBC + signal can-reader |

---

## WebSocket

| Path | Description |
|---|---|
| `ws://localhost/ws/client` | Real-time updates from backend to frontend |

Proxied through nginx in Docker. In npm dev, Vite proxies `/ws` to the backend directly.

---

## Firestore data model

```
users/{uid}
├── screens/{screenId}    dashboard layout + widgets
├── frames/{frameId}      CAN frame definitions
├── pi/primary            Pi connection status
└── logs/{logId}          signal + operational logs
```
