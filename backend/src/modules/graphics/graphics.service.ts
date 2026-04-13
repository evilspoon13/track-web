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

function parseHexMaybe(value: unknown): number | unknown {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith("0x")) return value;
  const parsed = Number.parseInt(trimmed.slice(2), 16);
  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeWidgetFromPi(widget: Record<string, unknown>): Record<string, unknown> {
  const out = { ...widget };
  if (out.data && typeof out.data === "object") {
    const data = out.data as Record<string, unknown>;
    out.data = { ...data, can_id: parseHexMaybe(data.can_id) };
  }
  if (out.graph && typeof out.graph === "object") {
    const graph = out.graph as Record<string, unknown>;
    out.graph = { ...graph, x_can_id: parseHexMaybe(graph.x_can_id) };
  }
  return out;
}

function coerceScreenFromPi(screen: unknown): ScreenInfo | null {
  if (!screen || typeof screen !== "object") return null;
  const s = screen as Record<string, unknown>;
  if (typeof s.name !== "string" || !s.name.trim()) return null;
  const widgets = Array.isArray(s.widgets) ? (s.widgets as unknown[]) : [];
  return {
    ...(s as unknown as ScreenInfo),
    name: s.name,
    widgets: widgets
      .filter((w): w is Record<string, unknown> => !!w && typeof w === "object")
      .map((w) => normalizeWidgetFromPi(w)) as unknown as ScreenInfo["widgets"],
  };
}

export async function replaceAllScreensFromPi(deviceId: string, screens: unknown[]): Promise<void> {
  const normalizedScreens = screens.map(coerceScreenFromPi).filter((s): s is ScreenInfo => s !== null);
  const nextIds = new Set<string>(normalizedScreens.map((s) => encodeURIComponent(s.name)));

  const existing = await col(deviceId).get();
  const batch = db.batch();

  for (const doc of existing.docs) {
    if (!nextIds.has(doc.id)) batch.delete(doc.ref);
  }

  for (const screen of normalizedScreens) {
    const id = encodeURIComponent(screen.name);
    batch.set(col(deviceId).doc(id), { ...screen, updatedAt: FieldValue.serverTimestamp() });
  }

  await batch.commit();
}
