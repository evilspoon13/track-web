import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "../../lib/firebaseAdmin";

export async function registerDeviceHeartbeat(deviceId: string, hostname?: string): Promise<void> {
  await db.collection("devices").doc(deviceId).set({
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

export async function getDevice(deviceId: string): Promise<{ device_id: string; teamMembers: string[]; connected: boolean }> {
  const snap = await db.collection("devices").doc(deviceId).get();
  if (!snap.exists) {
    return { device_id: deviceId, teamMembers: [], connected: false };
  }
  const data = snap.data()!;
  return {
    device_id: deviceId,
    teamMembers: Array.isArray(data.teamMembers) ? data.teamMembers : [],
    connected: data.connected === true,
  };
}

export async function updateTeamMembers(deviceId: string, teamMembers: string[]): Promise<RegisterDeviceResult> {
  return registerDevice(deviceId, teamMembers);
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

  // Read current memberUids before overwriting so we can detect removals
  const existingSnap = await db.collection("devices").doc(deviceId).get();
  const oldMemberUids: string[] = existingSnap.exists
    ? (existingSnap.data()?.memberUids ?? [])
    : [];

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

  const newUidSet = new Set(memberUids);
  const removedUids = oldMemberUids.filter((uid: string) => !newUidSet.has(uid));

  // Overwrite each user's device mapping and clear removed users
  const batch = db.batch();
  for (const uid of memberUids) {
    batch.set(db.collection("users").doc(uid), { device_id: deviceId }, { merge: true });
  }
  for (const uid of removedUids) {
    batch.update(db.collection("users").doc(uid), { device_id: FieldValue.delete() });
  }
  await batch.commit();

  return { device_id: deviceId, teamMembers: normalizedEmails, memberUids };
}

