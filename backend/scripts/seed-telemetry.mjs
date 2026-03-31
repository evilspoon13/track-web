/**
 * Simulates a Pi sending live telemetry at 20 Hz.
 *
 * Signal format: "decimal_can_id:signal_name" → [min, max]
 * CAN ID reference:  0x100=256  0x200=512  0x300=768  0x400=1024
 *
 * To test different card types in the UI:
 *   1. Run this script — signals appear as GraphCards by default
 *   2. In the editor, assign a signal to a widget on the driver display screen
 *      and set its type: gauge / bar / number / indicator
 *   3. Refresh the Telemetry page — that signal now renders with its widget type
 *      (set widgetMin/widgetMax/thresholds on the widget to see full behavior)
 *
 * Usage:
 *   cd track-web/backend
 *   node scripts/seed-telemetry.mjs
 */

import WebSocket from "ws";

const SIGNALS = {
  // BMS frame (0x100 = 256)
  "256:state_of_charge":  [0,    100],
  "256:pack_voltage":     [280,  420],
  "256:pack_current":     [0,    400],
  "256:cell_temp_max":    [20,   60],

  // Motor controller frame (0x200 = 512)
  "512:motor_rpm":        [0,    6000],
  "512:motor_torque":     [0,    200],
  "512:motor_temp":       [20,   120],
  "512:inverter_temp":    [20,   100],

  // Vehicle dynamics frame (0x300 = 768)
  "768:vehicle_speed":    [0,    160],
  "768:throttle_pos":     [0,    100],
  "768:brake_pressure":   [0,    80],

  // Fault/status frame (0x400 = 1024) — binary 0/1, good for indicator cards
  "1024:bms_fault":       [0,    1],
  "1024:motor_fault":     [0,    1],
  "1024:cooling_active":  [0,    1],
};

const DEVICE_ID = "dev-001";
const WS_URL = "ws://localhost:3000/ws/pi";
const INTERVAL_MS = 50;    // 20 Hz
const HEARTBEAT_MS = 1000;

// Start continuous signals at 40% of range; binary signals at 0
const current = Object.fromEntries(
  Object.entries(SIGNALS).map(([k, [min, max]]) => [
    k,
    max - min === 1 ? 0 : min + (max - min) * 0.4,
  ])
);

// Binary signals flip every ~5-15 seconds randomly
const binaryCounters = Object.fromEntries(
  Object.entries(SIGNALS)
    .filter(([, [min, max]]) => max - min === 1)
    .map(([k]) => [k, 100 + Math.floor(Math.random() * 200)])
);

function tick(ws) {
  const signals = {};
  for (const [key, [min, max]] of Object.entries(SIGNALS)) {
    const range = max - min;
    if (range === 1) {
      binaryCounters[key]--;
      if (binaryCounters[key] <= 0) {
        current[key] = current[key] === 0 ? 1 : 0;
        binaryCounters[key] = 100 + Math.floor(Math.random() * 200);
      }
      signals[key] = current[key];
    } else {
      current[key] = Math.max(
        min,
        Math.min(max, current[key] + (Math.random() - 0.5) * range * 0.02)
      );
      signals[key] = parseFloat(current[key].toFixed(2));
    }
  }
  ws.send(JSON.stringify({ type: "telemetry", device_id: DEVICE_ID, ts: Date.now(), signals }));
}

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log(`connected to ${WS_URL} as ${DEVICE_ID}`);
  console.log(`sending ${Object.keys(SIGNALS).length} signals at ${1000 / INTERVAL_MS} Hz\n`);
  for (const [key, [min, max]] of Object.entries(SIGNALS)) {
    const [id, name] = key.split(":");
    const hex = "0x" + parseInt(id).toString(16).toUpperCase().padStart(3, "0");
    console.log(`  ${hex}  ${name.padEnd(22)} [${min} – ${max}]`);
  }
  console.log("\nCtrl+C to stop");

  ws.send(JSON.stringify({ type: "heartbeat", device_id: DEVICE_ID }));

  const telemetryTimer = setInterval(() => tick(ws), INTERVAL_MS);
  const heartbeatTimer = setInterval(() => {
    ws.send(JSON.stringify({ type: "heartbeat", device_id: DEVICE_ID }));
  }, HEARTBEAT_MS);

  ws.on("close", () => {
    clearInterval(telemetryTimer);
    clearInterval(heartbeatTimer);
    console.log("disconnected");
  });
});

ws.on("error", (err) => {
  console.error("ws error:", err.message);
  process.exit(1);
});
