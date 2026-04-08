export interface LogChunkEntry {
  ts: number;
  can_id: number;
  value: number;
}

export interface LogChunkDocument {
  session: string;
  startTs: number;
  endTs: number;
  count: number;
  entries: LogChunkEntry[];
}

export interface LogEntry {
  ts: number;
  can_id: number;
  value: number;
  session: string;
  frame_name: string | null;
}

export interface LogsResponse {
  entries: LogEntry[];
  nextCursor: number | null;
}

export interface DaySummary {
  date: string;
  count: number;
}

export interface DaysResponse {
  days: DaySummary[];
}
