# Backend Architecture

## Tech Stack

| Layer | Library / Version |
|-------|-------------------|
| Runtime | Node.js 20 (CommonJS) |
| Framework | Express 5 |
| Language | TypeScript (strict) |
| Auth | Firebase Admin SDK (ID token verification) |
| Database | Firestore |
| WebSockets | `ws` |
| DBC parsing | `candied` |
| Dev tooling | `ts-node-dev`, `tsc` |

## Directory Layout

```
backend/
  src/
    server.ts                 # Entry point — starts Express + createRealtimeGateway on :3000
    app.ts                    # Middleware wiring + route mounts
    lib/
      firebaseAdmin.ts        # Firebase Admin SDK init (adminAuth, db)
    common/
      logger.ts               # Structured logger
      types/
        api.types.ts          # Shared response types
      system/                 # Deprecated stubs kept for reference (sendReloadSignal, atomicWriteJson)
    middleware/
      auth.ts                 # requireAuth — verifies Firebase ID token; sets req.uid and auto-links req.deviceId from team-member email
      deviceAuth.ts           # requireDeviceAuth — verifies x-device-id + x-device-secret headers (Pi → server)
      deviceAccess.ts         # requireDevice — 403 { msg: "no_device_paired" } if req.deviceId wasn't set by requireAuth
      httpLogger.ts           # Request logging
    modules/
      graphics/               # Screen CRUD (devices/{deviceId}/screens)
      dbc/                    # DBC file read/write/parse (devices/{deviceId}/dbc/content)
      devices/                # Pi registration + team-member management (top-level devices/{deviceId})
      logs/                   # Paginated log reads (devices/{deviceId}/logs/{chunkId})
      prefs/                  # Per-user screen prefs (users/{uid}/prefs/screens)
      realtime/               # WebSocket gateway + connection management + Pi config push
```

## Middleware chain

`app.ts` layers the middleware in a specific order so auth and device-resolution happen before any module sees the request:

```mermaid
flowchart TD
    R["Incoming request"] --> HL[httpLogger]
    HL --> JP["express.json()"]
    JP --> P1{"Path starts /api/devices?"}
    P1 -- yes --> DA[requireDeviceAuth<br/>x-device-secret] --> DR[devicesRoutes]
    P1 -- no --> RA[requireAuth<br/>Firebase Bearer token]
    RA --> RU["sets req.uid"]
    RU --> P2{"Path starts /api/prefs?"}
    P2 -- yes --> PR[prefsRoutes<br/>user-scoped]
    P2 -- no --> RD[requireDevice<br/>resolves req.deviceId]
    RD --> P3{"Path"}
    P3 -- /api/graphics --> GR[graphicsRoutes]
    P3 -- /api/dbc --> DBCR[dbcRoutes]
    P3 -- /api/logs --> LR[logsRoutes]
    P3 -- "/api/device(user)" --> UD["devicesController<br/>getDevice / updateTeamMembers"]
```

The ordering means:
- **Pi-originated calls** hit `/api/devices/register` with `x-device-id` + `x-device-secret` and bypass Firebase auth entirely.
- **User-scoped prefs** skip `requireDevice` — a user can always read/write their own screen prefs even before being linked to a device.
- **Everything else under `/api/`** requires both a Firebase token and a linked device; returns `403 { "msg": "no_device_paired" }` otherwise.
- `requireAuth` itself also performs device auto-linking: if `users/{uid}.device_id` isn't set yet, it looks for a `devices` doc whose `teamMembers` array contains the user's email and persists that mapping back into `users/{uid}`. In dev (`AUTH_ENABLED=false`) the middleware also bypasses token verification and uses `uid = "dev-user"`.

## Module pattern

Every functional area follows the same four-file layout:

```
modules/<name>/
  <name>.routes.ts        # Router — maps HTTP verbs to controller functions
  <name>.controller.ts    # Request/response layer — parses params, calls service, formats response
  <name>.service.ts       # Firestore access and business logic
  <name>.types.ts         # Local type definitions
```

Shared response types live in `common/types/api.types.ts`. The `realtime` module doesn't follow the four-file split — it owns `realtime.gateway.ts` (wss server + path routing), `realtime.service.ts` (connection registry + Pi/client message handlers + Pi config push helpers), and `realtime.types.ts` (connection shapes).

## Key design patterns

- **Persistence** — all user/device data is in Firestore; there are no local files, SQLite, or caches. `FieldValue.serverTimestamp()` is used for every `updatedAt` / `createdAt`.
- **Auth layers** — Firebase ID token for users, shared `x-device-secret` header for Pi. `req.uid` and `req.deviceId` are decorated by middleware; controllers trust them.
- **Cross-tab broadcast** — mutations in `graphics/` and `prefs/` call `broadcastToDeviceClients` / `broadcastToUserClients` (from `realtime.service`) so every open browser tab on the same device/user updates without polling. Pi-initiated `graphics_upload` frames also fan out the resulting `screen_updated` / `screen_deleted` events.
- **Config to Pi** — screen writes rebuild the full screen list and push it in-band via `sendConfigToPi` → `{ type: "config_update", payload }` on the Pi's `/ws/pi` socket. No versioning, no replay on reconnect — if the Pi isn't connected the push is skipped. See [sync-protocol.md](sync-protocol.md).
- **Pi → cloud config** — the Pi pushes whole-file updates via `graphics_upload` / `dbc_upload` WSS messages, which the realtime service applies straight into the Firestore domain stores (`graphicsService.replaceAllScreensFromPi`, `dbcService.uploadDbc`) and then rebroadcasts to sibling tabs.

## Module responsibilities

| Module | Firestore target | Purpose |
|---|---|---|
| `graphics` | `devices/{deviceId}/screens/<encodeURIComponent(name)>` | Screen CRUD; broadcasts `screen_updated` / `screen_deleted`; pushes full `{ screens }` payload to Pi on upsert |
| `dbc` | `devices/{deviceId}/dbc/content` | Raw DBC text write; parsed on read via `candied`; serialised back to `.dbc` on JSON write |
| `devices` | `devices/{deviceId}` | Pi device registration + team-member management; heartbeat + connection status writes |
| `logs` | `devices/{deviceId}/logs/{auto}` | Chunked log writes (`MAX_ENTRIES_PER_CHUNK = 30_000`); paginated reads over chunk docs |
| `prefs` | `users/{uid}/prefs/screens` | Per-user pin + order for screen tabs |
| `realtime` | — (in-memory connection registry) | WSS gateway for both `/ws/pi` and `/ws/client`; Pi message demux; cross-tab fan-out; `sendConfigToPi` / `sendMessageToPi` helpers |

## What this backend does not do

- No local config files, no `SIGHUP`. Config reaches the Pi only via `/ws/pi`.
- No versioned file store or reconnect replay — config pushes are in-band only; a Pi that was offline when a screen changed will not receive that change until the next cloud-side write.
- No polling loops for Pi status beyond the 5 s stale-connection monitor in `realtime.service` (drops Pi sockets after `PI_DEADLINE_MS = 20_000` without a heartbeat; purges log upload sessions after 5 min).
- No test suite yet.
- No ORM — Firestore is accessed directly through `db` from `lib/firebaseAdmin`.
