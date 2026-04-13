# Backend REST API Reference

All paths are rooted at the backend's base URL (`http://localhost:3000` in dev, `https://<fly-app>.fly.dev` in prod).

## Auth

| Header | Purpose |
|---|---|
| `Authorization: Bearer <Firebase ID token>` | Required for every `/api/*` route below unless noted |
| `x-device-secret: <DEVICE_SECRET>` | Required for `/api/devices/*` routes (Pi-originated) |

Requests missing a valid token return `401`. Requests from a Firebase user whose account is not linked to a device return `403 Device not registered` — except for `/api/prefs/*`, which is user-scoped.

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
1. Write to `devices/{deviceId}/screens/{screenId}`.
2. Broadcast `{ type: "screen_updated", name, screen }` to every `/ws/client` socket tagged with the same `deviceId`.
3. Rebuild the full screen list and commit to `devices/{deviceId}/files/graphics` via `SyncService.commitCloudGeneratedGraphics`.
4. Send the resulting `sync_download` to the Pi (if connected).

**Response 200:** `{ "success": true }`

### `DELETE /api/graphics/screens/:screenId`

Delete a screen. Same broadcast + sync effects as POST. Returns `{ success: true }` on 200, `{ success: false }` on 404.

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

Write frame definitions as JSON. Body: `{ frames: FrameParserConfig }`.

### `POST /api/dbc/upload`

Parse raw `.dbc` text and store it.

**Body:** `{ raw: string }`
**Response 200:** `{ "frames": FrameParserConfig }`
**Response 400:** `{ "msg": "Failed to parse DBC" }` (invalid `.dbc`)

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
- Normalizes emails (lowercased, trimmed).
- Resolves Firebase UIDs via `adminAuth.getUserByEmail`.
- Writes `teamMembers`, `memberUids` to the device doc.
- Sets `users/{uid}.device_id = <this device>` for every newly-linked user; clears it for every removed user.

**Response 200:** `{ device_id, teamMembers, memberUids }`

---

## Device registration (Pi-only, device-secret auth)

### `POST /api/devices/register`

Pi registers itself at boot.

**Headers:** `x-device-secret: <DEVICE_SECRET>`

**Body:**
```json
{ "device_id": "track-pi-01", "team_members": ["alice@example.com"] }
```

**Response 200:** same shape as `POST /api/device/team-members`.
