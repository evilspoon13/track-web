# T.R.A.C.K. Backend Documentation

The backend is an Express 5 + TypeScript service that bridges the web frontend to the on-car Raspberry Pi. It persists all user-facing config to Firebase Firestore, fans out real-time events to browser tabs, and pushes the full graphics config to the Pi in-band over a WebSocket.

## Documents

| File | Description |
|------|-------------|
| [architecture.md](architecture.md) | Tech stack, directory layout, middleware chain, module pattern, module responsibilities |
| [api.md](api.md) | Full REST endpoint reference — auth, params, request/response shapes |
| [realtime.md](realtime.md) | `/ws/pi` and `/ws/client` message protocols, connection lifecycle, cross-tab broadcasts |
| [sync-protocol.md](sync-protocol.md) | Cloud ↔ Pi config exchange (graphics + DBC) over `/ws/pi` |
| [data-model.md](../../documentation/data-model.md) | Firestore schema (shared with the frontend docs) |

## Quick start

```bash
cd track-web/backend
npm install
npm run dev      # ts-node-dev on :3000 with hot reload
npm run build    # tsc → dist/
npm run start    # node dist/server.js (production)
```

Runs against Firebase emulators when `FIRESTORE_EMULATOR_HOST` + `FIREBASE_AUTH_EMULATOR_HOST` are set by the dev script.

## System context

```
[Frontend browser tabs]
        │        ▲
  REST  │        │ WSS (/ws/client)
        ▼        │
[Backend (Fly: track-web)]
        │        ▲
        │        │ WSS (/ws/pi)
        ▼        │
  Firestore    [Pi: cloud-bridge → graphics-engine]
```

- **REST** for CRUD against user/device-scoped data.
- **`/ws/client`** (one or more per user) for live telemetry / GPS fan-out and cross-tab editor events.
- **`/ws/pi`** (one per device) for Pi heartbeat, telemetry/GPS ingest, binary log upload, Pi-initiated graphics/DBC uploads, and cloud → Pi `config_update` / `team_members_update` pushes.

## Deployment

Auto-deploys on push to `main` via Fly's GitHub integration (Fly app `track-web`). No manual deploy step needed.
