import * as crypto from "node:crypto";
import { db } from "../../lib/firebaseAdmin";
import { logger } from "../../common/logger";
import {
  BaseRevMismatchError,
  type FileState,
  DISPLAY_DBC_FILE_ID,
  GRAPHICS_FILE_ID,
  SYNC_PROTOCOL_VERSION,
  type SyncStateFileMeta,
  type SyncStateMessage,
  type SyncDownloadMessage,
  type SyncModifiedBy,
  type SyncPlanMessage,
} from "./sync.types";

export { DISPLAY_DBC_FILE_ID, GRAPHICS_FILE_ID, SYNC_PROTOCOL_VERSION, BaseRevMismatchError };
export type {
  FileState,
  SyncDownloadMessage,
  SyncStateFileMeta,
  SyncStateMessage,
  SyncModifiedBy,
  SyncPlanMessage,
};

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fileRef(deviceId: string, fileId: string) {
  return db.collection("devices").doc(deviceId).collection("files").doc(fileId);
}

export async function getFileState(deviceId: string, fileId: string): Promise<FileState | null> {
  const snap = await fileRef(deviceId, fileId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const version_id = typeof data.version_id === "number" ? data.version_id : 0;
  const content_b64 = typeof data.content_b64 === "string" ? data.content_b64 : "";
  const modified_by = (data.modified_by === "pi" ? "pi" : "cloud") as SyncModifiedBy;
  const modified_at_ms = typeof data.modified_at_ms === "number" ? data.modified_at_ms : 0;
  const change_id = typeof data.change_id === "string" ? data.change_id : "";
  const content_size = typeof data.content_size === "number" ? data.content_size : 0;
  return {
    file_id: fileId,
    version_id,
    content_b64,
    modified_by,
    modified_at_ms,
    change_id,
    content_size,
  };
}

function coerceHelloMeta(files: unknown, fileId: string): SyncStateFileMeta | null {
  if (!Array.isArray(files)) return null;
  for (const f of files) {
    if (!f || typeof f !== "object") continue;
    const obj = f as SyncStateFileMeta;
    if (obj.file_id === fileId) return obj;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function buildDownloadMessage(state: FileState): SyncDownloadMessage {
  return {
    type: "sync_download",
    file_id: state.file_id,
    version_id: state.version_id,
    content_b64: state.content_b64,
    modified_by: state.modified_by,
    modified_at_ms: state.modified_at_ms,
  };
}

export async function planForState(deviceId: string, hello: SyncStateMessage, fileId: string): Promise<SyncPlanMessage> {
  const meta = coerceHelloMeta(hello.files, fileId);
  const pending_upload = asBool(meta?.pending_upload) ?? false;
  const pending_base_version_id = asNumber(meta?.pending_base_version_id) ?? null;
  const pi_version_id = asNumber(meta?.version_id) ?? null;

  const cloud = await getFileState(deviceId, fileId);
  if (!cloud || !cloud.content_b64) {
    // No cloud copy yet; only allow upload fast-forward from rev=0.
    if (pending_upload && pending_base_version_id === 0) {
      return { type: "sync_plan", file_id: fileId, action: "request_upload", expected_base_version_id: 0 };
    }
    return { type: "sync_plan", file_id: fileId, action: "noop" };
  }

  if (pending_upload) {
    if (pending_base_version_id === cloud.version_id) {
      return { type: "sync_plan", file_id: fileId, action: "request_upload", expected_base_version_id: cloud.version_id };
    }
    return { type: "sync_plan", file_id: fileId, action: "send_download", download: buildDownloadMessage(cloud) };
  }

  if (pi_version_id === cloud.version_id) {
    return { type: "sync_plan", file_id: fileId, action: "noop" };
  }

  return { type: "sync_plan", file_id: fileId, action: "send_download", download: buildDownloadMessage(cloud) };
}

async function commitFileWithContent(
  deviceId: string,
  fileId: string,
  content: Buffer,
  modified_by: SyncModifiedBy,
  change_id: string,
  base_version_id: number | null
): Promise<{ state: FileState; alreadyCommitted: boolean }> {
  const content_b64 = content.toString("base64");
  const now = Date.now();

  const ref = fileRef(deviceId, fileId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data() ?? {}) as Record<string, unknown>) : {};
    const current_rev = typeof current.version_id === "number" ? current.version_id : 0;
    const current_change_id = typeof current.change_id === "string" ? current.change_id : "";
    const current_b64 = typeof current.content_b64 === "string" ? current.content_b64 : "";
    const current_modified_by = (current.modified_by === "pi" ? "pi" : "cloud") as SyncModifiedBy;
    const current_modified_at_ms = typeof current.modified_at_ms === "number" ? current.modified_at_ms : 0;
    const current_size = typeof current.content_size === "number" ? current.content_size : 0;

    if (current_change_id && current_change_id === change_id) {
      return {
        state: {
          file_id: fileId,
          version_id: current_rev,
          content_b64: current_b64,
          modified_by: current_modified_by,
          modified_at_ms: current_modified_at_ms,
          change_id: current_change_id,
          content_size: current_size,
        },
        alreadyCommitted: true,
      };
    }

    if (base_version_id !== null && base_version_id !== current_rev) {
      const currentState: FileState = {
        file_id: fileId,
        version_id: current_rev,
        content_b64: current_b64,
        modified_by: current_modified_by,
        modified_at_ms: current_modified_at_ms,
        change_id: current_change_id,
        content_size: current_size,
      };
      throw new BaseRevMismatchError(base_version_id, currentState);
    }

    const next_rev = current_rev + 1;
    const next: FileState = {
      file_id: fileId,
      version_id: next_rev,
      content_b64,
      modified_by,
      modified_at_ms: now,
      change_id,
      content_size: content.byteLength,
    };
    tx.set(ref, next, { merge: true });
    return { state: next, alreadyCommitted: false };
  });
}

export async function commitCloudGeneratedGraphics(
  deviceId: string,
  payload: unknown
): Promise<FileState> {
  const bytes = Buffer.from(stableStringify(payload), "utf8");
  const change_id = crypto.randomUUID();
  const { state } = await commitFileWithContent(deviceId, GRAPHICS_FILE_ID, bytes, "cloud", change_id, null);
  return state;
}

export async function commitCloudRawFile(
  deviceId: string,
  fileId: string,
  raw: string
): Promise<FileState> {
  const bytes = Buffer.from(raw, "utf8");
  const change_id = crypto.randomUUID();
  const { state } = await commitFileWithContent(deviceId, fileId, bytes, "cloud", change_id, null);
  return state;
}

export async function commitPiUpload(
  deviceId: string,
  fileId: string,
  content: Buffer,
  change_id: string,
  base_version_id: number
): Promise<{ state: FileState; alreadyCommitted: boolean }> {
  return commitFileWithContent(deviceId, fileId, content, "pi", change_id, base_version_id);
}

export function logSyncEvent(kind: string, fields: Record<string, unknown>) {
  logger.info("sync", kind, fields);
}
