import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "../../lib/firebaseAdmin";

export async function registerDeviceHeartbeat(deviceId: string, hostname?: string): Promise<void> {
  await db.collection("devices").doc(deviceId).set({
    uuid: deviceId,
    ...(hostname ? { hostname } : {}),
    lastSeen: FieldValue.serverTimestamp(),
    connected: true,
  }, { merge: true });
}

export async function markDeviceDisconnected(deviceId: string): Promise<void> {
  await db.collection("devices").doc(deviceId).set(
    { connected: false, lastSeen: FieldValue.serverTimestamp() },
    { merge: true }
  );
}
import type { RegisterDeviceResult } from "./devices.types";

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function registerDevice(deviceId: string, teamMembers: string[]): Promise<RegisterDeviceResult> {
  const normalizedEmails = unique(
    teamMembers
      .map((e) => (typeof e === "string" ? normalizeEmail(e) : null))
      .filter((e): e is string => Boolean(e))
  );

  const memberUids: string[] = [];

  for (const email of normalizedEmails) {
    try {
      const user = await adminAuth.getUserByEmail(email);
      memberUids.push(user.uid);
    } catch {
      // user doesn't exist yet in DB, device id will be assigned once user registers with auth
    }
  }

  // Store the device membership
  await db.collection("devices").doc(deviceId).set(
    {
      device_id: deviceId,
      teamMembers: normalizedEmails,
      memberUids,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Overwrite each user's device mapping
  const batch = db.batch();
  for (const uid of memberUids) {
    batch.set(db.collection("users").doc(uid), { device_id: deviceId }, { merge: true });
  }
  await batch.commit();

  return { device_id: deviceId, teamMembers: normalizedEmails, memberUids };
}

