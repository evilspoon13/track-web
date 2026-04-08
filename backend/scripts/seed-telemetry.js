/**
 * Simulate a Pi sending live telemetry + periodic log uploads via WebSocket.
 *
 * Streams fake CAN signals at ~10 Hz for testing the Telemetry page.
 * Every LOG_INTERVAL_S seconds, uploads accumulated entries as a binary
 * log chunk so the Log Terminal history panel also gets data.
 *
 * Usage: npm run seed-telemetry
 * Stop with Ctrl+C.
 */

const WebSocket = require("ws");

const BACKEND_WS = process.env.BACKEND_WS || "ws://localhost:3000/ws/pi";
const DEVICE_ID = process.env.DEVICE_ID || "dev-001";
const DEVICE_SECRET = process.env.DEVICE_SECRET || "test";
const INTERVAL_MS = 100;       // 10 Hz telemetry
const LOG_INTERVAL_S = 10;     // upload a log chunk every N seconds

const SIGNALS = [
  { can_id: 256, signal: "rpm",         min: 0,   max: 8000 },
  { can_id: 257, signal: "motor_temp",  min: 20,  max: 120 },
  { can_id: 512, signal: "voltage",     min: 280, max: 403 },
  { can_id: 513, signal: "battery_temp",min: 15,  max: 60 },
  { can_id: 768, signal: "speed",       min: 0,   max: 130 },
];

let tick = 0;
const logBuffer = [];
let uploadCount = 0;

function generatePayload() {
  const data = {};
  const now = Date.now();
  for (const sig of SIGNALS) {
    const t = tick / 100;
    const noise = (Math.random() - 0.5) * (sig.max - sig.min) * 0.05;
    const value = sig.min + (sig.max - sig.min) * (0.3 + 0.4 * Math.sin(t * Math.PI * 0.5)) + noise;
    const rounded = Math.round(value * 100) / 100;
    data[`${sig.can_id}:${sig.signal}`] = rounded;
    logBuffer.push({ ts: now, can_id: sig.can_id, value: rounded });
  }
  tick++;
  return data;
}

// Build binary buffer matching embedded data-logger format:
//   24 bytes per entry, little-endian:
//     offset  0: int64   timestamp_ms
//     offset  8: uint32  can_id
//     offset 12: uint32  pad (0)
//     offset 16: double  value
function buildLogBinary(entries) {
  const buf = Buffer.alloc(entries.length * 24);
  for (let i = 0; i < entries.length; i++) {
    const off = i * 24;
    buf.writeBigInt64LE(BigInt(entries[i].ts), off);
    buf.writeUInt32LE(entries[i].can_id, off + 8);
    buf.writeUInt32LE(0, off + 12);
    buf.writeDoubleLE(entries[i].value, off + 16);
  }
  return buf;
}

function uploadLogChunk(ws) {
  if (logBuffer.length === 0) return;
  const entries = logBuffer.splice(0, logBuffer.length);
  const binary = buildLogBinary(entries);
  const filename = `sim_${Date.now()}.bin`;
  const b64 = binary.toString("base64");

  ws.send(JSON.stringify({ type: "log_upload_start", filename, file_size: binary.length }));
  ws.send(JSON.stringify({ type: "log_upload_chunk", filename, chunk_index: 0, data: b64 }));
  ws.send(JSON.stringify({ type: "log_upload_end", filename, total_chunks: 1 }));

  uploadCount++;
  console.log(`[log upload #${uploadCount}] ${entries.length} entries (${binary.length} bytes)`);
}

const ws = new WebSocket(BACKEND_WS, {
  headers: {
    "x-device-id": DEVICE_ID,
    "x-device-secret": DEVICE_SECRET,
  },
});

let telemetryInterval;
let heartbeatInterval;
let logUploadInterval;

ws.on("open", () => {
  console.log(`Connected to ${BACKEND_WS} as device '${DEVICE_ID}'`);
  console.log(`Streaming telemetry at ${1000 / INTERVAL_MS} Hz, log uploads every ${LOG_INTERVAL_S}s`);
  console.log("Ctrl+C to stop.\n");

  ws.send(JSON.stringify({ type: "heartbeat", device_id: DEVICE_ID }));

  telemetryInterval = setInterval(() => {
    const signals = generatePayload();
    ws.send(JSON.stringify({
      type: "telemetry",
      device_id: DEVICE_ID,
      ts: Date.now(),
      signals,
    }));
  }, INTERVAL_MS);

  heartbeatInterval = setInterval(() => {
    ws.send(JSON.stringify({ type: "heartbeat", device_id: DEVICE_ID }));
  }, 1000);

  logUploadInterval = setInterval(() => uploadLogChunk(ws), LOG_INTERVAL_S * 1000);
});

ws.on("close", () => {
  console.log("Disconnected.");
  clearInterval(telemetryInterval);
  clearInterval(heartbeatInterval);
  clearInterval(logUploadInterval);
  process.exit(0);
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
  clearInterval(telemetryInterval);
  clearInterval(heartbeatInterval);
  clearInterval(logUploadInterval);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nStopping...");
  clearInterval(telemetryInterval);
  clearInterval(heartbeatInterval);
  clearInterval(logUploadInterval);
  ws.close();
});
