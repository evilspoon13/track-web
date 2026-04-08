/**
 * Seed the Firebase emulator with sample log chunk(s) for dev-001.
 *
 * Usage: npm run seed-logs
 */

const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "track-csce483";
const DEVICE_ID = process.env.DEVICE_ID || "dev-001";
const ENTRY_COUNT = 200;
const SESSION = "seed-session-1";

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

const SIGNALS = [
  { can_id: 0x100, label: "Motor RPM",      min: 0,    max: 8000 },
  { can_id: 0x101, label: "Motor Temp",      min: 20,   max: 120 },
  { can_id: 0x200, label: "Battery Voltage", min: 280,  max: 403 },
  { can_id: 0x201, label: "Battery Temp",    min: 15,   max: 60 },
  { can_id: 0x300, label: "Vehicle Speed",   min: 0,    max: 130 },
];

async function main() {
  const col = db.collection("devices").doc(DEVICE_ID).collection("logs");
  const now = Date.now();

  const entries = [];
  for (let i = 0; i < ENTRY_COUNT; i++) {
    const sig = SIGNALS[i % SIGNALS.length];
    const t = i / ENTRY_COUNT;
    const noise = (Math.random() - 0.5) * (sig.max - sig.min) * 0.1;
    const value = sig.min + (sig.max - sig.min) * (0.3 + 0.4 * Math.sin(t * Math.PI * 4)) + noise;

    entries.push({
      ts: now - (ENTRY_COUNT - i) * 500,
      can_id: sig.can_id,
      value: Math.round(value * 100) / 100,
    });
  }

  await col.doc().set({
    session: SESSION,
    startTs: entries[0].ts,
    endTs: entries[entries.length - 1].ts,
    count: entries.length,
    entries,
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`Seeded ${ENTRY_COUNT} entries as 1 chunk for device '${DEVICE_ID}' (session: ${SESSION}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
