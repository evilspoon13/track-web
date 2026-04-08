/**
 * Simulate a Pi sending live telemetry via WebSocket to the backend.
 * Streams fake CAN signals at ~10 Hz for testing the Telemetry page.
 *
 * Usage: npm run seed-telemetry
 * Stop with Ctrl+C.
 */

const WebSocket = require("ws");

const BACKEND_WS = process.env.BACKEND_WS || "ws://localhost:3000/ws/pi";
const DEVICE_ID = process.env.DEVICE_ID || "dev-001";
const DEVICE_SECRET = process.env.DEVICE_SECRET || "";
const INTERVAL_MS = 100;

const SIGNALS = [
  { can_id: 256, signal: "rpm",         min: 0,   max: 8000 },
  { can_id: 257, signal: "motor_temp",  min: 20,  max: 120 },
  { can_id: 512, signal: "voltage",     min: 280, max: 403 },
  { can_id: 513, signal: "battery_temp",min: 15,  max: 60 },
  { can_id: 768, signal: "speed",       min: 0,   max: 130 },
];

let tick = 0;

function generatePayload() {
  const data = {};
  for (const sig of SIGNALS) {
    const t = tick / 100;
    const noise = (Math.random() - 0.5) * (sig.max - sig.min) * 0.05;
    const value = sig.min + (sig.max - sig.min) * (0.3 + 0.4 * Math.sin(t * Math.PI * 0.5)) + noise;
    data[`${sig.can_id}:${sig.signal}`] = Math.round(value * 100) / 100;
  }
  tick++;
  return data;
}

const ws = new WebSocket(BACKEND_WS, {
  headers: {
    "x-device-id": DEVICE_ID,
    "x-device-secret": DEVICE_SECRET,
  },
});

let interval;

ws.on("open", () => {
  console.log(`Connected to ${BACKEND_WS} as device '${DEVICE_ID}'`);
  console.log(`Streaming telemetry at ${1000 / INTERVAL_MS} Hz. Ctrl+C to stop.`);

  // Send initial heartbeat
  ws.send(JSON.stringify({ type: "heartbeat", device_id: DEVICE_ID }));

  interval = setInterval(() => {
    const payload = generatePayload();
    ws.send(JSON.stringify({
      type: "telemetry",
      device_id: DEVICE_ID,
      payload,
    }));
  }, INTERVAL_MS);
});

ws.on("close", () => {
  console.log("Disconnected.");
  clearInterval(interval);
  process.exit(0);
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
  clearInterval(interval);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nStopping...");
  clearInterval(interval);
  ws.close();
});
