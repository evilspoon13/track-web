/**
 * Simulate a Pi streaming GPS fixes via WebSocket.
 *
 * Matches the payload emitted by track-embedded/cloud-bridge (main.cpp):
 *   { type: "gps", device_id, ts, lat, lon, speed_kmh, heading, gps_ts }
 *
 * Drives a synthetic lap of a Monaco-inspired closed circuit: a hand-placed
 * waypoint polygon (Ste Devote → Beau Rivage → Casino → Grand Hotel Hairpin
 * → tunnel sweep → Nouvelle Chicane → Tabac → Swimming Pool → Rascasse →
 * Anthony Noghes → Start/Finish) smoothed with a closed Catmull-Rom spline.
 * Speed naturally varies — faster on the straights, slower through tight
 * corners — because the parameter advances at a constant rate while arc
 * length along the spline doesn't. Heading is the path tangent.
 *
 * Usage: npm run seed-gps
 * Stop with Ctrl+C.
 */

const WebSocket = require("ws");

const BACKEND_WS = process.env.BACKEND_WS || "ws://localhost:3000/ws/pi";
const DEVICE_ID = process.env.DEVICE_ID || "dev-001";
const DEVICE_SECRET = process.env.DEVICE_SECRET || "test";
const PI_CLOCK_OFFSET_MS = Number(process.env.PI_CLOCK_OFFSET_S ?? 0) * 1000;
const GPS_INTERVAL_MS = 100;        // 1 Hz — matches cloud-bridge
const HEARTBEAT_INTERVAL_MS = 1000;

// Center of the simulated track (default: TAMU RELLIS Circuit area).
const ORIGIN_LAT = Number(process.env.ORIGIN_LAT ?? 30.6386);
const ORIGIN_LON = Number(process.env.ORIGIN_LON ?? -96.4758);
const TRACK_EXTENT_M = Number(process.env.TRACK_EXTENT_M ?? 250); // max distance from origin, meters
const LAP_SECONDS = Number(process.env.LAP_SECONDS ?? 60);        // time to complete one lap
const JITTER_M = Number(process.env.JITTER_M ?? 0.8);             // GPS receiver noise, meters
const LAP_WOBBLE_M = Number(process.env.LAP_WOBBLE_M ?? 6);       // max racing-line shift per lap, meters
const LAP_TIME_VAR = Number(process.env.LAP_TIME_VAR ?? 0.04);    // ±fraction lap-time variance (e.g. 0.04 = ±4%)

// Rough meters-per-degree at the origin latitude.
const METERS_PER_DEG_LAT = 111_320;
const METERS_PER_DEG_LON = 111_320 * Math.cos((ORIGIN_LAT * Math.PI) / 180);

// Monaco-inspired waypoint polygon, traced clockwise from the Start/Finish
// line. Coordinates are in an arbitrary unit frame — the curve is rescaled
// below so the farthest point from origin lands at TRACK_EXTENT_M. These
// aren't geographically accurate, just tuned to give the recognisable
// Monaco silhouette and hit the iconic corners in the right order.
const TRACK_WAYPOINTS = [
  { x:  0.30, y: -0.90 }, // Start/Finish line
  { x:  0.40, y: -0.55 },
  { x:  0.48, y: -0.30 }, // Ste Devote (T1, right)
  { x:  0.30, y: -0.18 },
  { x:  0.15, y:  0.02 }, // Beau Rivage climb
  { x:  0.00, y:  0.22 },
  { x: -0.10, y:  0.42 }, // Massenet (left, before Casino)
  { x: -0.25, y:  0.52 }, // Casino Square
  { x: -0.38, y:  0.46 },
  { x: -0.52, y:  0.34 }, // Mirabeau
  { x: -0.62, y:  0.22 }, // Grand Hotel Hairpin entry
  { x: -0.56, y:  0.12 }, // Hairpin apex (the famous U-turn)
  { x: -0.40, y:  0.16 }, // Hairpin exit
  { x: -0.20, y:  0.22 }, // Portier
  { x:  0.05, y:  0.30 }, // Tunnel entry
  { x:  0.30, y:  0.22 }, // Tunnel middle (long right sweeper)
  { x:  0.46, y:  0.06 }, // Tunnel exit
  { x:  0.55, y: -0.06 }, // Nouvelle Chicane (left)
  { x:  0.46, y: -0.14 }, // Nouvelle Chicane (right)
  { x:  0.36, y: -0.20 }, // Tabac (left)
  { x:  0.22, y: -0.26 }, // Swimming Pool entry
  { x:  0.10, y: -0.20 }, // Pool chicane (kink 1)
  { x: -0.02, y: -0.28 }, // Pool chicane (kink 2)
  { x: -0.16, y: -0.24 }, // Pool exit
  { x: -0.30, y: -0.42 }, // Rascasse entry
  { x: -0.20, y: -0.54 }, // Rascasse apex (tight right hairpin)
  { x: -0.02, y: -0.60 },
  { x:  0.14, y: -0.72 }, // Anthony Noghes
  { x:  0.24, y: -0.84 }, // back onto pit straight
];

const WP_N = TRACK_WAYPOINTS.length;

// Uniform closed Catmull-Rom spline evaluated at u ∈ [0, 1). Passes through
// every waypoint, rounds the sharp ones the way a racing line naturally
// would, and wraps seamlessly from the last waypoint back to the first.
function splineUnit(u) {
  const segF = (((u % 1) + 1) % 1) * WP_N;
  const i1 = Math.floor(segF) % WP_N;
  const f = segF - Math.floor(segF);
  const p0 = TRACK_WAYPOINTS[(i1 - 1 + WP_N) % WP_N];
  const p1 = TRACK_WAYPOINTS[i1];
  const p2 = TRACK_WAYPOINTS[(i1 + 1) % WP_N];
  const p3 = TRACK_WAYPOINTS[(i1 + 2) % WP_N];
  const f2 = f * f;
  const f3 = f2 * f;
  const catmull = (a, b, c, d) =>
    0.5 *
    (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
  return {
    x: catmull(p0.x, p1.x, p2.x, p3.x),
    y: catmull(p0.y, p1.y, p2.y, p3.y),
  };
}

// Scale factor so the farthest spline point from origin sits at TRACK_EXTENT_M.
const TRACK_SCALE_M = (() => {
  let maxR = 0;
  for (let i = 0; i < 2000; i++) {
    const p = splineUnit(i / 2000);
    const r = Math.hypot(p.x, p.y);
    if (r > maxR) maxR = r;
  }
  return TRACK_EXTENT_M / maxR;
})();

// Base position in meters relative to origin for parameter s ∈ [0, 2π).
function trackBase(s) {
  const p = splineUnit(s / (2 * Math.PI));
  return { x: p.x * TRACK_SCALE_M, y: p.y * TRACK_SCALE_M };
}

// Per-lap "racing line" offset: small perpendicular shift that differs each
// lap so laps don't overlap 1:1. Uses the true path normal (tangent rotated
// 90°) so the offset stays meaningful around non-convex sections like the
// hairpin.
function racingLineOffset(s, lap) {
  const lapPhase = (lap * 2.3) % (2 * Math.PI);
  const lapAmp = LAP_WOBBLE_M * (0.6 + 0.4 * Math.sin(lap * 1.7 + 0.5));
  return lapAmp * Math.sin(2 * s + lapPhase);
}

function sampleTrack(s, lap) {
  const base = trackBase(s);
  // Tangent via a small forward step on the unperturbed base curve.
  const ahead = trackBase(s + 0.005);
  const tx = ahead.x - base.x;
  const ty = ahead.y - base.y;
  const tLen = Math.hypot(tx, ty) || 1;
  const nx = -ty / tLen; // left-hand normal
  const ny = tx / tLen;
  const offset = racingLineOffset(s, lap);
  return {
    x: base.x + nx * offset,
    y: base.y + ny * offset,
  };
}

// Per-lap effective lap duration. Deterministic ±LAP_TIME_VAR spread so
// consecutive laps have visibly different times (without randomness that
// would make repeated runs uncomparable).
function effectiveLapSeconds(lap) {
  return LAP_SECONDS * (1 + LAP_TIME_VAR * Math.sin(lap * 1.7));
}

// Phase-based accumulator: advances at the current lap's rate so per-lap
// durations actually vary in wallclock time.
let phase = 0;
let currentLap = 0;

function generateGps() {
  const dt = GPS_INTERVAL_MS / 1000;
  const lapSec = effectiveLapSeconds(currentLap);
  const dsPerTick = (2 * Math.PI / lapSec) * dt;

  const here = sampleTrack(phase, currentLap);
  // Next-tick sample (no jitter) gives a clean tangent for heading + speed.
  const ahead = sampleTrack(phase + dsPerTick, currentLap);

  // GPS jitter applied only to the reported position, not the tangent.
  const dxM = here.x + (Math.random() - 0.5) * 2 * JITTER_M;
  const dyM = here.y + (Math.random() - 0.5) * 2 * JITTER_M;
  const lat = ORIGIN_LAT + dyM / METERS_PER_DEG_LAT;
  const lon = ORIGIN_LON + dxM / METERS_PER_DEG_LON;

  // Heading + speed from the deterministic tangent.
  const vx = (ahead.x - here.x) / dt;
  const vy = (ahead.y - here.y) / dt;
  const speedKmh = Math.hypot(vx, vy) * 3.6;
  // Heading: 0 = north, clockwise. atan2(east, north) = atan2(vx, vy).
  let heading = (Math.atan2(vx, vy) * 180) / Math.PI;
  if (heading < 0) heading += 360;

  phase += dsPerTick;
  currentLap = Math.floor(phase / (2 * Math.PI));

  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    speed_kmh: Math.round(speedKmh * 100) / 100,
    heading: Math.round(heading * 10) / 10,
    lap: currentLap,
  };
}

const ws = new WebSocket(BACKEND_WS, {
  headers: {
    "x-device-id": DEVICE_ID,
    "x-device-secret": DEVICE_SECRET,
  },
});

let gpsInterval;
let heartbeatInterval;

ws.on("open", () => {
  console.log(`Connected to ${BACKEND_WS} as device '${DEVICE_ID}'`);
  console.log(
    `Simulating Monaco-style circuit: origin=(${ORIGIN_LAT}, ${ORIGIN_LON}) extent=${TRACK_EXTENT_M}m lap=${LAP_SECONDS}s`
  );
  if (PI_CLOCK_OFFSET_MS !== 0) {
    console.log(`Pi clock offset: ${PI_CLOCK_OFFSET_MS / 1000}s (simulating desynced RTC)`);
  }
  console.log(`Streaming at ${1000 / GPS_INTERVAL_MS} Hz. Ctrl+C to stop.\n`);

  ws.send(JSON.stringify({ type: "heartbeat", device_id: DEVICE_ID }));

  gpsInterval = setInterval(() => {
    const fix = generateGps();
    const now = Date.now();
    const piNow = now + PI_CLOCK_OFFSET_MS;
    const msg = {
      type: "gps",
      device_id: DEVICE_ID,
      ts: piNow,
      lat: fix.lat,
      lon: fix.lon,
      speed_kmh: fix.speed_kmh,
      heading: fix.heading,
      gps_ts: piNow,
    };
    ws.send(JSON.stringify(msg));
    console.log(
      `[gps] lap=${fix.lap} lat=${fix.lat} lon=${fix.lon} speed=${fix.speed_kmh} km/h heading=${fix.heading}°`
    );
  }, GPS_INTERVAL_MS);

  heartbeatInterval = setInterval(() => {
    ws.send(JSON.stringify({ type: "heartbeat", device_id: DEVICE_ID }));
  }, HEARTBEAT_INTERVAL_MS);
});

ws.on("close", () => {
  console.log("Disconnected.");
  clearInterval(gpsInterval);
  clearInterval(heartbeatInterval);
  process.exit(0);
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
  clearInterval(gpsInterval);
  clearInterval(heartbeatInterval);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nStopping...");
  clearInterval(gpsInterval);
  clearInterval(heartbeatInterval);
  ws.close();
});
