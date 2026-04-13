import { db } from "../../lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { ScreenPrefs } from "./prefs.types";

const doc = (uid: string) =>
  db.collection("users").doc(uid).collection("prefs").doc("screens");

export async function readScreenPrefs(uid: string): Promise<ScreenPrefs> {
  const snap = await doc(uid).get();
  if (!snap.exists) return { pinnedNames: [], order: [] };
  const data = snap.data() ?? {};
  const pinnedNames = Array.isArray(data.pinnedNames)
    ? data.pinnedNames.filter((v): v is string => typeof v === "string")
    : [];
  const order = Array.isArray(data.order)
    ? data.order.filter((v): v is string => typeof v === "string")
    : [];
  return { pinnedNames, order };
}

export async function writeScreenPrefs(uid: string, prefs: ScreenPrefs): Promise<void> {
  await doc(uid).set({
    pinnedNames: prefs.pinnedNames,
    order: prefs.order,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
