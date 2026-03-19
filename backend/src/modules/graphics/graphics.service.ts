import { db } from "../../lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { ApiMessage } from "../../common/types/api.types";
import type { ScreenInfo } from "./graphics.types";

const col = (uid: string) =>
  db.collection("users").doc(uid).collection("screens");

export async function getScreenNames(uid: string): Promise<string[] | null> {
  const snap = await col(uid).select("name").get();
  if (snap.empty) return null;
  return snap.docs.map((d) => d.data().name as string);
}

export async function getScreenById(uid: string, name: string): Promise<ScreenInfo | null> {
  const snap = await col(uid).where("name", "==", name).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0]!.data() as ScreenInfo;
}

export async function saveScreen(uid: string, screenId: string, screen: ScreenInfo): Promise<ApiMessage> {
  await col(uid).doc(encodeURIComponent(screenId))
    .set({ ...screen, updatedAt: FieldValue.serverTimestamp() });
  return { msg: "Config Updated" };
}

export async function deleteScreenById(uid: string, name: string): Promise<ApiMessage> {
  const snap = await col(uid).where("name", "==", name).limit(1).get();
  if (snap.empty) return { msg: "fail" };
  await snap.docs[0]!.ref.delete();
  return { msg: "Screen Deleted" };
}
