/**
 * Seed the Firebase emulator: create a test user, device doc, and link them.
 *
 * If no users exist in the Auth emulator, creates a test user automatically.
 * Then links all existing users to the device.
 *
 * Usage: npm run seed-device
 */

const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "track-csce483";
const DEVICE_ID = process.env.DEVICE_ID || "dev-001";
const TEST_EMAIL = "test@track.dev";
const TEST_DISPLAY_NAME = "Test Driver";

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  let listResult = await auth.listUsers();
  let users = listResult.users;

  if (users.length === 0) {
    console.log("No users found — creating test Google user...");

    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";

    // Use signInWithIdp to create a Google-linked account in the emulator
    const idpUrl = `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`;
    const mockIdToken = JSON.stringify({
      sub: "google-test-uid",
      email: TEST_EMAIL,
      email_verified: true,
      name: TEST_DISPLAY_NAME,
    });

    const res = await fetch(idpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `id_token=${mockIdToken}&providerId=google.com`,
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create Google user: ${err}`);
    }

    const data = await res.json();
    console.log(`Created Google user: ${TEST_EMAIL} (uid: ${data.localId})`);

    listResult = await auth.listUsers();
    users = listResult.users;
  }

  const emails = [];
  const uids = [];

  for (const user of users) {
    if (user.email) emails.push(user.email.toLowerCase());
    uids.push(user.uid);
  }

  // Create the device doc
  await db.collection("devices").doc(DEVICE_ID).set(
    {
      device_id: DEVICE_ID,
      teamMembers: emails,
      memberUids: uids,
      connected: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Link each existing user to the device
  const batch = db.batch();
  for (const uid of uids) {
    batch.set(db.collection("users").doc(uid), { device_id: DEVICE_ID }, { merge: true });
  }
  await batch.commit();

  console.log(`Linked ${users.length} user(s) to device '${DEVICE_ID}'.`);

  // Seed DBC (CAN frame definitions) matching seed-telemetry.js signals
  const dbcRaw = [
    'VERSION ""',
    "",
    "NS_ :",
    "",
    "BS_:",
    "",
    "BU_: Vector__XXX",
    "",
    'BO_ 256 Engine: 8 Vector__XXX',
    ' SG_ rpm : 0|16@1+ (1,0) [0|8000] "" Vector__XXX',
    "",
    'BO_ 257 MotorTemp: 8 Vector__XXX',
    ' SG_ motor_temp : 0|16@1+ (1,0) [20|120] "C" Vector__XXX',
    "",
    'BO_ 512 Battery: 8 Vector__XXX',
    ' SG_ voltage : 0|16@1+ (0.01,0) [280|403] "V" Vector__XXX',
    "",
    'BO_ 513 BatteryTemp: 8 Vector__XXX',
    ' SG_ battery_temp : 0|16@1+ (1,0) [15|60] "C" Vector__XXX',
    "",
    'BO_ 768 Vehicle: 8 Vector__XXX',
    ' SG_ speed : 0|16@1+ (1,0) [0|130] "km/h" Vector__XXX',
    "",
  ].join("\n");

  await db.collection("devices").doc(DEVICE_ID).collection("dbc").doc("content").set({
    raw: dbcRaw,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("Seeded DBC with 5 CAN frames (Engine, MotorTemp, Battery, BatteryTemp, Vehicle).");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
