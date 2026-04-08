# T.R.A.C.K. Frontend Documentation

T.R.A.C.K. (Telemetry Rendering And Capture Kit) is the FSAE Electric team's race-day telemetry system. This documentation covers `track-web/frontend` — a React drag-and-drop dashboard configurator that lets engineers build widget layouts for the on-car display, view live telemetry signals over WebSocket, and browse historical log data.

## Documents

| File | Description |
|------|-------------|
| [architecture.md](architecture.md) | Tech stack, directory layout, component hierarchy, and state management overview |
| [user-flows.md](user-flows.md) | Mermaid flowcharts of key user journeys (auth, drag-drop, save, DBC upload, etc.) |
| [data-flows.md](data-flows.md) | Mermaid sequence diagrams for data movement — state, API calls, WebSocket, log pagination |
| [components.md](components.md) | Reference for the 8 key components: purpose, state consumed, actions dispatched, side-effects |
| [data-model.md](data-model.md) | Firestore schema — all collections, subcollections, and document fields |

## Quick Start

```bash
cd track-web/frontend
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # tsc + vite production build
npm run preview    # preview production build locally
```

Set `VITE_AUTH_ENABLED=false` in `.env.local` to bypass Firebase auth during local development.

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

The frontend saves screen configs and CAN frame definitions to the backend. The backend persists them to Firestore and pushes the new layout to the Pi over a persistent WebSocket. The Pi reloads the running display process immediately.

## Deployment

| App | Fly app name | Method |
|-----|-------------|--------|
| Backend | `track-web` | Auto-deploys on push to `main` via Fly GitHub integration |
| Frontend | `track-web-frontend` | Manual: `cd frontend && fly deploy` |
