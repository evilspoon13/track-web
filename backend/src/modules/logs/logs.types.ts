export interface LogDocument {
  ts: number;
  can_id: number;
  value: number;
  session: string;
}

export interface LogEntry extends LogDocument {
  frame_name: string | null;
}

export interface LogsResponse {
  entries: LogEntry[];
  nextCursor: number | null;
}
