# T.R.A.C.K. Frontend Documentation

T.R.A.C.K. (Telemetry Rendering And Capture Kit) is the FSAE Electric team's race-day telemetry system. This documentation covers `track-web/frontend` — a React drag-and-drop dashboard configurator that lets engineers build widget layouts for the on-car display, view live telemetry signals over WebSocket, browse and export historical log data, and manage device team-member access.

## Documents

| File | Description |
|------|-------------|
| [architecture.md](architecture.md) | Tech stack, directory layout, component hierarchy, state shape, action catalog, and backend API surface |
| [user-flows.md](user-flows.md) | Mermaid flowcharts of key user journeys (auth, drag-drop, save, pin/reorder, bulk delete, DBC upload) |
| [data-flows.md](data-flows.md) | Mermaid sequence diagrams for data movement — initial load, save, live telemetry, cross-tab sync, log viewer, CSV export |
| [components.md](components.md) | Reference for the core components: purpose, state consumed, actions dispatched, side-effects |
| [data-model.md](data-model.md) | Firestore schema — collections, subcollections, documents, and field definitions |

## Quick Start

```bash
cd track-web/frontend
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # tsc + vite production build
npm run preview    # preview production build locally
```

Set `VITE_AUTH_ENABLED=false` in `.env.local` to bypass Firebase auth during local UI development.

## System Context

```
[track-web/frontend] ◄──► [track-web/backend] ◄──► Firebase Firestore
                                    │
                              WSS /ws/pi
                                    │
                           [Pi cloud-bridge]
                                    │
                         [graphics-engine → HDMI]
```

The frontend saves screen configs and CAN frame definitions through the backend, which persists them to Firestore and commits them to the versioned sync store. The Pi pulls configs on reconnect via the sync protocol over `/ws/pi` and reloads its graphics-engine. Backend-originated writes also broadcast to every open browser tab on the same user account (`/ws/client`) so all tabs stay in sync without reloading.

## Deployment

| App | Fly app name | Method |
|-----|-------------|--------|
| Backend | `track-web` | Auto-deploys on push to `main` via Fly GitHub integration |
| Frontend | `track-web-frontend` | Manual: `cd frontend && fly deploy` |
