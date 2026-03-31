/**
 * seed-logs.mjs
 * Simulates a Pi uploading a binary log file over WebSocket.
 *
 * Run from the backend directory:
 *   cd track-web/backend && node seed-logs.mjs
 *
 * Options (edit below):
 *   DEVICE_ID  — must match the device_id you query with in the frontend
 *   CAN_IDS    — hex CAN IDs to generate entries for (should match your saved DBC)
 *   ENTRIES    — number of log entries to generate
 */

import WebSocket from "ws";

const DEVICE_ID = "dev-001";
const SESSION   = `log_${Date.now()}`;
const CAN_IDS   = [0x100, 0x200]; // match CAN IDs in your saved DBC
const ENTRIES   = 20;

// --- Build binary payload ---
// 24 bytes per entry, little-endian:
//   offset  0: int64_t  timestamp_ms
//   offset  8: uint32_t can_id
//   offset 12: uint32_t pad (0)
//   offset 16: double   value
function buildBinary() {
  const buf = Buffer.alloc(ENTRIES * 24);
  const now = Date.now();
  for (let i = 0; i < ENTRIES; i++) {
    const offset = i * 24;
    const canId  = CAN_IDS[i % CAN_IDS.length];
    const ts     = BigInt(now - (ENTRIES - i) * 1000); // 1s apart, ascending
    const value  = parseFloat((Math.random() * 5000).toFixed(2));
    buf.writeBigInt64LE(ts, offset);
    buf.writeUInt32LE(canId, offset + 8);
    buf.writeUInt32LE(0, offset + 12);
    buf.writeDoubleLE(value, offset + 16);
  }
  return buf;
}

function send(ws, obj) {
  ws.send(JSON.stringify(obj));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const ws = new WebSocket("ws://localhost:3000/ws/pi");

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  console.log("connected");

  // 1. Register as Pi
  send(ws, { type: "heartbeat", device_id: DEVICE_ID });
  await sleep(200);
  console.log(`registered as device: ${DEVICE_ID}`);

  // 2. Build binary
  const binary   = buildBinary();
  const filename = `${SESSION}.bin`;
  const b64      = binary.toString("base64");

  // 3. Upload start
  send(ws, { type: "log_upload_start", filename, file_size: binary.length });
  await sleep(100);
  console.log(`upload start: ${filename} (${binary.length} bytes, ${ENTRIES} entries)`);

  // 4. Single chunk
  send(ws, { type: "log_upload_chunk", filename, chunk_index: 0, data: b64 });
  await sleep(100);
  console.log("chunk 0 sent");

  // 5. Upload end
  send(ws, { type: "log_upload_end", filename, total_chunks: 1 });
  await sleep(500);
  console.log("upload end sent");

  ws.close();
  console.log(`done — check Firestore: devices/${DEVICE_ID}/logs/`);
}

run().catch((err) => {
  console.error("error:", err.message);
  process.exit(1);
});
