import { db } from "../../lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { ApiMessage } from "../../common/types/api.types";
import type { ScreenInfo } from "./graphics.types";

const col = (deviceId: string) =>
  db.collection("devices").doc(deviceId).collection("screens");

export async function getScreenNames(deviceId: string): Promise<string[]> {
  const snap = await col(deviceId).select("name").get();
  if (snap.empty) return [];
  return snap.docs.map((d) => d.data().name as string);
}

export async function getAllScreens(deviceId: string): Promise<ScreenInfo[]> {
  const snap = await col(deviceId).get();
  if (snap.empty) return [];
  return snap.docs.map((d) => d.data() as ScreenInfo);
}

export async function getScreenById(deviceId: string, name: string): Promise<ScreenInfo | null> {
  const snap = await col(deviceId).where("name", "==", name).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0]!.data() as ScreenInfo;
}

export async function saveScreen(deviceId: string, screenId: string, screen: ScreenInfo): Promise<ApiMessage> {
  await col(deviceId).doc(encodeURIComponent(screenId))
    .set({ ...screen, updatedAt: FieldValue.serverTimestamp() });
  return { msg: "Config Updated" };
}

export async function deleteScreenById(deviceId: string, name: string): Promise<ApiMessage> {
  const snap = await col(deviceId).where("name", "==", name).limit(1).get();
  if (snap.empty) return { msg: "fail" };
  await snap.docs[0]!.ref.delete();
  return { msg: "Screen Deleted" };
}

export async function replaceAllScreensFromPi(deviceId: string, config: unknown): Promise<void> {
  const screens = (config as { screens: ScreenInfo[] }).screens;
  if (!Array.isArray(screens)) throw new Error("Invalid graphics config: expected screens[]");
  const nextNames = new Set(screens.map((s) => s.name));

  const existingNames = await getScreenNames(deviceId);
  const toDelete = existingNames.filter((name) => !nextNames.has(name));

  await Promise.all([
    ...screens.map((screen) => saveScreen(deviceId, screen.name, screen)),
    ...toDelete.map((name) => deleteScreenById(deviceId, name)),
  ]);
}

