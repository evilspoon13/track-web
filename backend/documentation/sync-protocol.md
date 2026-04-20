# Cloud ↔ Pi Config Exchange

There is no versioned sync protocol in the current backend. Config flows between cloud and Pi as whole-file WSS messages on `/ws/pi`; both sides overwrite rather than merge, and nothing is versioned or replayed on reconnect. This document captures the two halves of that exchange.

| Direction | Message `type` | Contents |
|---|---|---|
| Cloud → Pi | `config_update` | Full normalized `{ screens }` payload |
| Cloud → Pi | `team_members_update` | `{ team_members: string[] }` |
| Pi → Cloud | `graphics_upload` | Full `{ screens }` payload (Pi captive portal edit) |
| Pi → Cloud | `dbc_upload` | Raw `.dbc` text |

See [realtime.md](realtime.md) for the full `/ws/pi` message catalogue.

## Cloud → Pi: graphics (`config_update`)

Triggered on every `POST /api/graphics/screens/:screenId`:

```
Frontend POST /api/graphics/screens/:name
  → graphicsService.saveScreen                 (write devices/{deviceId}/screens/<encodeURIComponent(name)>)
  → broadcastToDeviceClients screen_updated    (fan-out to sibling tabs)
  → pushFullConfigToPi:
      → graphicsService.getAllScreens          (rebuild full set)
      → sendConfigToPi(deviceId, { screens })  (applies normalizeConfigForPi — hex-encodes can_id / x_can_id)
        → sendMessageToPi → WSS { device_id, type: "config_update", payload }
```

Key properties:

- **Push is in-band only.** `sendMessageToPi` looks up the Pi's socket in `piSockets` and returns `false` if the socket is missing or not `OPEN`. Nothing persists the push for replay.
- **No versioning.** The payload is the full set of screens every time. The Pi is expected to replace its local copy.
- **`DELETE /api/graphics/screens/:screenId` does not push to the Pi.** Only the screen-deleted broadcast goes out on `/ws/client`. The Pi is re-synced on the next upsert.
- **DBC writes (`POST /api/dbc`, `POST /api/dbc/upload`) do not push to the Pi.** The Pi reads DBC on its own schedule.

Example frame the Pi receives:

```json
{
  "device_id": "track-pi-01",
  "type": "config_update",
  "payload": {
    "screens": [
      {
        "name": "Main",
        "widgets": [
          { "type": "gauge", "position": { "x": 0, "y": 0, "width": 2, "height": 2 },
            "data": { "can_id": "0x100", "signal": "temp_c", "min": 0, "max": 120 } }
        ]
      }
    ]
  }
}
```

`normalizeConfigForPi` re-hex-encodes `can_id` / `graph.x_can_id` so the Pi sees strings like `"0x100"` regardless of how the frontend stored them (controller normalises the other direction to a number before writing Firestore).

## Cloud → Pi: team members (`team_members_update`)

Sent by `devices.controller.updateTeamMembers` after the Firestore write succeeds:

```json
{ "device_id": "...", "type": "team_members_update", "team_members": ["alice@example.com"] }
```

Fire-and-forget, same in-band semantics as `config_update`.

## Pi → Cloud: graphics (`graphics_upload`)

Pi-side edits (captive portal) push the full screen set up as:

```json
{
  "device_id": "track-pi-01",
  "type": "graphics_upload",
  "payload": { "screens": [ ... ] }
}
```

`realtime.service` handles it asynchronously:

1. Load the current screen names for the device.
2. Diff against the names in the uploaded payload (names not in the upload are considered deletes).
3. Call `graphicsService.replaceAllScreensFromPi(deviceId, payload)` which concurrently saves every uploaded screen and deletes the removed ones.
4. Emit one `screen_updated` on `/ws/client` per screen in the upload and one `screen_deleted` per removed name, so sibling tabs re-render without reload.

Validation is minimal: the payload must have a `screens` array; individual screen objects are trusted. Failures are logged and the upload is dropped — there is no `sync_reject` reply.

## Pi → Cloud: DBC (`dbc_upload`)

```json
{ "device_id": "track-pi-01", "type": "dbc_upload", "payload": "<raw .dbc text>" }
```

`realtime.service` calls `dbcService.uploadDbc(deviceId, raw)` which writes the raw text to `devices/{deviceId}/dbc/content` and parses it via `candied` for the return value. Failures are logged; there is no reply frame.

## What's missing (vs. a real sync protocol)

- No per-file version IDs, no `change_id` idempotency, no rebase handshake.
- No reconnect replay — a screen edited while the Pi was offline will only reach the Pi when the next screen upsert triggers another push.
- No conflict resolution — whoever writes last wins. If the Pi pushes `graphics_upload` while the cloud is pushing `config_update` the two may race.
- No per-field delta — every push is the whole screen set.

Code references:

- `src/modules/realtime/realtime.service.ts` — `sendConfigToPi`, `sendMessageToPi`, `handlePiMessage` (handles `graphics_upload`, `dbc_upload`)
- `src/modules/graphics/graphics.controller.ts` — `pushFullConfigToPi`
- `src/modules/graphics/graphics.service.ts` — `replaceAllScreensFromPi`
- `src/modules/dbc/dbc.service.ts` — `uploadDbc`
