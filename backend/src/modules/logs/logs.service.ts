import { db } from "../../lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { readDbc } from "../dbc/dbc.service";
import type { DaySummary, LogChunkDocument, LogChunkEntry, LogEntry, LogsResponse } from "./logs.types";

const ENTRY_SIZE = 24;
const MAX_ENTRIES_PER_CHUNK = 30_000;
const CHUNK_FETCH_SIZE = 5;

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
  const raw = decodeBinary(buf);
  if (raw.length === 0) return;

  raw.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

  const col = db.collection("devices").doc(deviceId).collection("logs");

  for (let start = 0; start < raw.length; start += MAX_ENTRIES_PER_CHUNK) {
    const slice = raw.slice(start, start + MAX_ENTRIES_PER_CHUNK);
    const entries: LogChunkEntry[] = slice.map((e) => ({
      ts: e.timestamp_ms,
      can_id: e.can_id,
      value: e.value,
    }));

    await col.doc().set({
      session,
      startTs: entries[0]!.ts,
      endTs: entries[entries.length - 1]!.ts,
      count: entries.length,
      entries,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  console.log(`[logs] persisted ${raw.length} entries (${Math.ceil(raw.length / MAX_ENTRIES_PER_CHUNK)} chunk(s)) for device=${deviceId} session=${session}`);
}

export async function getLogDays(deviceId: string): Promise<DaySummary[]> {
  const col = db.collection("devices").doc(deviceId).collection("logs");
  const snap = await col.select("startTs", "count").get();
  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const data = doc.data() as { startTs: number; count: number };
    const day = new Date(data.startTs).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + data.count);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getLogs(
  deviceId: string,
  limit: number,
  beforeTs?: number,
  dateStartMs?: number,
  dateEndMs?: number
): Promise<LogsResponse> {
  const col = db.collection("devices").doc(deviceId).collection("logs");

  let baseQuery: FirebaseFirestore.Query = col.orderBy("startTs", "desc");
  if (beforeTs !== undefined) {
    baseQuery = baseQuery.where("startTs", "<", beforeTs);
  }
  if (dateEndMs !== undefined) {
    baseQuery = baseQuery.where("startTs", "<", dateEndMs);
  }

  const collected: { ts: number; can_id: number; value: number; session: string }[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (collected.length <= limit) {
    let q = baseQuery.limit(CHUNK_FETCH_SIZE);
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const chunk = doc.data() as LogChunkDocument;
      if (dateStartMs !== undefined && chunk.endTs < dateStartMs) continue;
      for (const e of chunk.entries) {
        if (beforeTs !== undefined && e.ts >= beforeTs) continue;
        if (dateStartMs !== undefined && e.ts < dateStartMs) continue;
        if (dateEndMs !== undefined && e.ts >= dateEndMs) continue;
        collected.push({ ts: e.ts, can_id: e.can_id, value: e.value, session: chunk.session });
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < CHUNK_FETCH_SIZE) break;
  }

  collected.sort((a, b) => b.ts - a.ts);

  const hasMore = collected.length > limit;
  const page = collected.slice(0, limit);

  const dbc = await readDbc(deviceId);

  const entries: LogEntry[] = page.map((e) => {
    const hex = "0x" + e.can_id.toString(16);
    const frame_name = dbc?.frames[hex]?.can_id_label ?? null;
    return { ts: e.ts, can_id: e.can_id, value: e.value, session: e.session, frame_name };
  });

  const nextCursor = hasMore ? page[page.length - 1]!.ts : null;

  return { entries, nextCursor };
}
