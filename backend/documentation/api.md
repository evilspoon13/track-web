# Backend REST API Reference

All paths are rooted at the backend's base URL (`http://localhost:3000` in dev, `https://<fly-app>.fly.dev` in prod).

## Auth

| Header | Purpose |
|---|---|
| `Authorization: Bearer <Firebase ID token>` | Required for every `/api/*` route below unless noted |
| `x-device-id: <deviceId>` + `x-device-secret: <DEVICE_SECRET>` | Required for `/api/devices/*` routes (Pi-originated) |

Requests missing a valid token return `401`. Requests from a Firebase user whose account is not linked to a device return `403 { "msg": "no_device_paired" }` — except for `/api/prefs/*`, which is user-scoped. `requireAuth` also auto-links the user to a device whose `teamMembers` array contains their email, so a first login after being added to a team works without a manual link step.

When `AUTH_ENABLED=false` (the `npm run dev` script sets this) `requireAuth` skips token verification and sets `req.uid = "dev-user"` instead.

---

## Graphics

### `GET /api/graphics/screens`

List screen names saved for this user's device.

**Response:**
```json
{ "screens": ["Main", "Aux", "Diagnostics"] }
```

### `GET /api/graphics/screens/:screenId`

Fetch a single screen.

**Response 200:**
```json
{
  "name": "Main",
  "widgets": [
    {
      "type": "gauge",
      "alarm": true,
      "position": { "x": 0, "y": 0, "width": 2, "height": 2 },
      "data": {
        "can_id": 256,
        "can_id_label": "MotorTemp",
        "signal": "temp_c",
        "unit": "°C",
        "min": 0, "max": 120,
        "caution_threshold": 80,
        "critical_threshold": 100
      }
    }
  ]
}
```

**Response 404:** `{ "msg": "Screen not found" }`

### `POST /api/graphics/screens/:screenId`

Upsert a screen. Body is the `BackendScreenInfo` shape above.

Side effects:
1. Normalize `can_id` / `graph.x_can_id` on each widget to a number, then write to `devices/{deviceId}/screens/<encodeURIComponent(name)>`.
2. Broadcast `{ type: "screen_updated", name, screen }` to every `/ws/client` socket tagged with the same `deviceId`.
3. Rebuild the full screen set via `graphicsService.getAllScreens` and push `{ type: "config_update", payload: { screens } }` to the Pi over `/ws/pi` (no-op if the Pi isn't connected). `can_id` fields are re-hex-encoded for the Pi's consumer.

**Response 200:** `{ "success": true }`

### `DELETE /api/graphics/screens/:screenId`

Delete a screen. Broadcasts `{ type: "screen_deleted", name }` to `/ws/client`. Does **not** re-push the full config to the Pi. Returns `{ success: true }` on 200, `{ success: false }` on 404.

---

## DBC

### `GET /api/dbc`

Parsed frame definitions.

**Response 200:**
```json
{
  "frames": {
    "0x100": {
      "can_id_label": "MotorTemp",
      "signals": [
        { "name": "temp_c", "start_byte": 0, "length": 2, "type": "int16", "scale": 0.1, "offset": 0 }
      ]
    }
  }
}
```

Returns `{ "frames": {} }` on 404 (no DBC stored yet).

### `POST /api/dbc`

Write frame definitions as JSON. Body is the `DbcConfig` shape `{ frames: Record<hexId, FrameDefinition> }`; the service serialises it back to `.dbc` text via `candied` before storing.

**Response 200:** `{ "msg": "Wrote DBC" }`

### `POST /api/dbc/upload`

Parse raw `.dbc` text and store it.

**Body:** `{ raw: string }`
**Response 200:** `{ "frames": ... }` (the parsed `DbcConfig`)
**Response 400:** `{ "msg": "Invalid DBC file — could not be parsed." }` (candied failed)
**Response 400:** `{ "msg": "Missing raw DBC string in body.raw" }` (empty body)

---

## Prefs (user-scoped, no device requirement)

### `GET /api/prefs/screens`

**Response 200:**
```json
{ "pinnedNames": ["Main"], "order": ["Aux", "Diagnostics"] }
```

Returns empty arrays if no prefs doc exists yet.

### `PUT /api/prefs/screens`

**Body:** `{ pinnedNames: string[], order: string[] }`

Side effect: broadcasts `{ type: "screen_prefs_updated", prefs }` to every `/ws/client` socket on the same `uid` (including sibling tabs on other devices).

**Response 200:** `{ "success": true }`

---

## Logs

### `GET /api/logs/days`

Day-rollup for the log browser.

**Response 200:**
```json
{ "days": [ { "date": "2026-04-12", "count": 14230 } ] }
```

`date` is `YYYY-MM-DD` in server-local ISO. Sorted newest-first.

### `GET /api/logs`

Paginated log entries, newest-first.

**Query:**
| Param | Type | Notes |
|---|---|---|
| `limit` | number | Default 100 |
| `before` | number | Exclusive upper bound on `ts` (ms). Used as the pagination cursor. |
| `date` | string | `YYYY-MM-DD`; restricts to that day |

**Response 200:**
```json
{
  "entries": [
    { "ts": 1712912400123, "can_id": 256, "value": 87.3, "session": "sim_1712912000000", "frame_name": "MotorTemp" }
  ],
  "nextCursor": 1712912390111
}
```

`nextCursor` is `null` when there are no older entries.

---

## Device (user-facing)

### `GET /api/device`

**Response 200:**
```json
{ "device_id": "track-pi-01", "teamMembers": ["alice@example.com"], "connected": true }
```

### `POST /api/device/team-members`

Update the team member list. Body: `{ team_members: string[] }`.

Side effects:
- Normalizes emails (lowercased, trimmed, deduped).
- Resolves Firebase UIDs via `adminAuth.getUserByEmail` (missing users are silently skipped — they get linked later on first login).
- Writes `teamMembers`, `memberUids`, `updatedAt` to the device doc.
- Sets `users/{uid}.device_id = <this device>` for every newly-linked user; clears it on removed users.
- Sends `{ type: "team_members_update", team_members }` to the Pi over `/ws/pi` if it's connected.

**Response 200:** `{ "ok": true, "team_members": string[] }`

---

## Device registration (Pi-only, device-secret auth)

### `POST /api/devices/register`

Pi registers itself at boot.

**Headers:** `x-device-id: <deviceId>`, `x-device-secret: <DEVICE_SECRET>`

**Body:**
```json
{ "teamMembers": ["alice@example.com"] }
```

`teamMembers` is optional — defaults to `[]` if missing or not an array.

**Response 200:**
```json
{ "msg": "Device registered", "data": { "device_id": "...", "teamMembers": [...], "memberUids": [...] } }
```
**Response 400:** `{ "error": "Missing x-device-id header" }`
