export const SYNC_PROTOCOL_VERSION = 1 as const;
export const GRAPHICS_FILE_ID = "graphics.json" as const;
export const DISPLAY_DBC_FILE_ID = "display.dbc" as const;

export type SyncModifiedBy = "cloud" | "pi";

export interface FileState {
  file_id: string;
  version_id: number;
  content_b64: string;
  modified_by: SyncModifiedBy;
  modified_at_ms: number;
  change_id: string;
  content_size: number;
}

export interface SyncDownloadMessage {
  type: "sync_download";
  file_id: string;
  version_id: number;
  content_b64: string;
  modified_by: SyncModifiedBy;
  modified_at_ms: number;
}

export type SyncPlanMessage =
  | { type: "sync_plan"; file_id: string; action: "noop" }
  | { type: "sync_plan"; file_id: string; action: "request_upload"; expected_base_version_id: number }
  | { type: "sync_plan"; file_id: string; action: "send_download"; download: SyncDownloadMessage };

export interface SyncStateFileMeta {
  file_id?: unknown;
  version_id?: unknown;
  pending_upload?: unknown;
  pending_base_version_id?: unknown;
  pending_change_id?: unknown;
}

export interface SyncStateMessage {
  type?: unknown;
  device_id?: unknown;
  protocol?: unknown;
  files?: unknown;
}

export interface SyncUploadMessage {
  type?: unknown;
  device_id?: unknown;
  file_id?: unknown;
  base_version_id?: unknown;
  change_id?: unknown;
  content_b64?: unknown;
}

export class BaseRevMismatchError extends Error {
  readonly expectedBaseRev: number;
  readonly current: FileState;

  constructor(expectedBaseRev: number, current: FileState) {
    super(`Base revision mismatch (expected ${expectedBaseRev}, current ${current.version_id})`);
    this.expectedBaseRev = expectedBaseRev;
    this.current = current;
  }
}
