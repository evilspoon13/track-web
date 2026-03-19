# T.R.A.C.K. — Web App

Telemetry Rendering And Capture Kit — web configurator for building and managing FSAE race-day display layouts.

---

## Overview

```
track-web/
  frontend/     React 18 + Vite + TypeScript — dashboard configurator UI
  backend/      Express 5 + TypeScript — config REST API
  config/       graphics.json, default.json — shared config files (read by Pi)
  docker-compose.yml
```

The frontend is a drag-and-drop dashboard editor. Users build screen layouts (widgets on a 10×6 grid) and save them. The backend exposes a REST API that reads/writes config files consumed by the on-car graphics engine.

Firebase handles auth (Google sign-in) and Firestore stores all user config in the cloud.

---

## Tech stack

| Layer      | Technology                  |
|------------|-----------------------------|
| Frontend   | React 18, Vite 6, TypeScript, Tailwind CSS 3 |
| Drag & drop | @dnd-kit/core              |
| Backend    | Express 5, TypeScript, Node.js 20 |
| Auth       | Firebase Auth (Google provider) |
| Database   | Firestore (per-user subcollections) |
| Container  | Docker + Docker Compose     |

---

## Environment variables

Copy `.env.example` to `.env` at the repo root and fill in your values:

```bash
cp .env.example .env
```

```
# Firebase (frontend — from Firebase Console → Project Settings → Your apps → SDK snippet)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Firebase Admin (backend — leave empty locally, use ADC instead)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Emulator (local dev — routes backend and frontend SDK to local emulator)
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# Backend port — defaults to 3000 if unset. Change if 3000 is taken on your machine.
PORT=
```

The `VITE_*` vars are baked into the frontend bundle at build time. The `FIREBASE_*` vars are read by the backend at runtime.

---

## Running locally — npm (recommended for development)

This method gives you hot reload on both frontend and backend. Use it alongside the Firestore emulator so local changes never touch the cloud database.

### 1. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. Start the Firestore emulator

Requires Firebase CLI (`npm install -g firebase-tools`) and a one-time `firebase init emulators` (see [Firestore emulator setup](#firestore-emulator-setup)).

```bash
# From track-web/
firebase emulators:start
```

Emulator endpoints:
- Firestore: `http://localhost:8080`
- Auth:      `http://localhost:9099`
- UI:        `http://localhost:4000`

### 3. Start the backend

```bash
# From track-web/backend/
npm run dev
```

Backend runs on `http://localhost:3000` by default. Set `PORT` in `.env` to use a different port (e.g. if 3000 is taken). `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are loaded from `.env` automatically via dotenv — no shell prefix needed.

### 4. Start the frontend

```bash
# From track-web/frontend/
npm run dev
```

Frontend runs on `http://localhost:5173`. When `import.meta.env.DEV` is true, the Firebase client SDK connects to the local Auth and Firestore emulators instead of the cloud.

---

## Running locally — Docker

Use Docker when you want to test the production build (compiled frontend served by nginx, compiled backend running as a Node process). The Firestore emulator is not wired into the Docker setup — Docker targets production-like builds that hit the real Firebase.

### Prerequisites

- Docker and Docker Compose installed
- `.env` filled in with real Firebase credentials (see [Environment variables](#environment-variables))

### Start all services

```bash
# From track-web/
docker compose up --build
```

Services:
- Frontend: `http://localhost:80` (nginx serving the Vite build)
- Backend:  `http://localhost:3000`

### Stop

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose up --build
```

### Docker internals

**Frontend** (`frontend/Dockerfile`): two-stage build — Node 20 builds the Vite bundle, nginx:alpine serves the static output.

**Backend** (`backend/Dockerfile`): two-stage build — Node 20 compiles TypeScript, a clean Node 20 image runs `dist/server.js`.

Note: the `config/` volume is mounted into the backend container so it can read/write `graphics.json` and `default.json`.

---

## Firestore emulator setup

One-time initialization (run from `track-web/`):

```bash
npm install -g firebase-tools
firebase login
firebase init emulators
# Select: Firestore, Authentication
# Ports: Firestore 8080, Auth 9099, UI 4000
```

This creates `firebase.json` (commit this) and `.firebaserc` (do not commit).

**Persist data between runs:**
```bash
# Export
firebase emulators:export ./emulator-data

# Import on next start
firebase emulators:start --import=./emulator-data
```

`emulator-data/` is gitignored.

---

## API surface

| Method | Path                              | Description                      |
|--------|-----------------------------------|----------------------------------|
| GET    | /api/graphics/screens             | List screen names                |
| GET    | /api/graphics/screens/:screenId   | Get a single screen config       |
| POST   | /api/graphics/screens/:screenId   | Upsert a screen config           |
| DELETE | /api/graphics/screens/:screenId   | Delete a screen                  |
| GET    | /api/frame-parser                 | Read CAN frame parser config     |
| POST   | /api/frame-parser                 | Upsert a frame definition        |
| GET    | /api/dbc                          | Read current DBC                 |
| POST   | /api/dbc                          | Write new DBC + signal can-reader |

All `/api/*` routes require a valid Firebase ID token in `Authorization: Bearer <token>`.

---

## Firestore data model

See `.claude/plans/firestore-data-model.md` for the full schema, security rules, and implementation plan.

Quick reference:

```
users/{uid}
├── screens/{screenId}    dashboard layout + widgets
├── frames/{frameId}      CAN frame definitions
├── pi/primary            Pi connection status
└── logs/{logId}          signal + operational logs
```
