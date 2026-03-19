import { db } from "../../lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { ApiMessage } from "../../common/types/api.types";
import type { FrameDefinition, FrameParserConfig } from "./frame-parser.types";

const col = (uid: string) =>
  db.collection("users").doc(uid).collection("frames");

export async function readConfig(uid: string): Promise<FrameParserConfig | null> {
  const snap = await col(uid).get();
  if (snap.empty) return null;
  const frames: FrameParserConfig["frames"] = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    frames[data.can_id as `0x${string}`] = {
      can_id_label: data.can_id_label as string,
      signals: data.signals as FrameDefinition["signals"],
    };
  });
  return { frames };
}

export async function updateConfig(uid: string, can_id: `0x${string}`, frame: FrameDefinition): Promise<ApiMessage> {
  await col(uid).doc(can_id)
    .set({ can_id, ...frame, updatedAt: FieldValue.serverTimestamp() });
  return { msg: "Config Updated" };
}
