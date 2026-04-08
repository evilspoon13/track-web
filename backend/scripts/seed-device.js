/**
 * Seed the Firebase emulator: create a device doc and link all existing auth users to it.
 *
 * Usage: npm run seed-emulator
 */

const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "track-csce483";
const DEVICE_ID = process.env.DEVICE_ID || "dev-001";

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  const listResult = await auth.listUsers();
  const users = listResult.users;

  if (users.length === 0) {
    console.log("No users found in Auth emulator. Nothing to do.");
    process.exit(0);
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
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
