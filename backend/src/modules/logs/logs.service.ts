import { db } from "../../lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { readDbc } from "../dbc/dbc.service";
import type { LogDocument, LogEntry, LogsResponse } from "./logs.types";

const ENTRY_SIZE = 24;

interface RawEntry {
  timestamp_ms: number;
  can_id: number;
  value: number;
}

function decodeBinary(buf: Buffer): RawEntry[] {
  const count = Math.floor(buf.length / ENTRY_SIZE);
  const entries: RawEntry[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i * ENTRY_SIZE;
    const timestamp_ms = Number(buf.readBigInt64LE(offset));
    const can_id = buf.readUInt32LE(offset + 8);
    const value = buf.readDoubleLE(offset + 16);
    entries.push({ timestamp_ms, can_id, value });
  }
  return entries;
}

export async function persistLogBuffer(deviceId: string, session: string, buf: Buffer): Promise<void> {
  const entries = decodeBinary(buf);
  if (entries.length === 0) return;

  const col = db.collection("devices").doc(deviceId).collection("logs");
  const BATCH_SIZE = 500;

  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const batch = db.batch();
    const slice = entries.slice(start, start + BATCH_SIZE);
    for (const e of slice) {
      batch.set(col.doc(), {
        ts: e.timestamp_ms,
        can_id: e.can_id,
        value: e.value,
        session,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  console.log(`[logs] persisted ${entries.length} entries for device=${deviceId} session=${session}`);
}

export async function getLogs(
  deviceId: string,
  uid: string,
  limit: number,
  beforeTs?: number
): Promise<LogsResponse> {
  const col = db.collection("devices").doc(deviceId).collection("logs");

  let q: FirebaseFirestore.Query =
    beforeTs !== undefined
      ? col.where("ts", "<", beforeTs).orderBy("ts", "desc").limit(limit + 1)
      : col.orderBy("ts", "desc").limit(limit + 1);

  const snap = await q.get();
  const docs = snap.docs;
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;

  const dbc = await readDbc(uid);

  const entries: LogEntry[] = page.map((doc) => {
    const d = doc.data() as LogDocument;
    const hex = "0x" + d.can_id.toString(16);
    const frame_name = dbc?.frames[hex]?.can_id_label ?? null;
    return { ts: d.ts, can_id: d.can_id, value: d.value, session: d.session, frame_name };
  });

  const nextCursor = hasMore ? (page[page.length - 1]!.data() as LogDocument).ts : null;

  return { entries, nextCursor };
}
