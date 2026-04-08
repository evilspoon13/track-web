export type WidgetType = "gauge" | "number" | "bar" | "graph" | "indicator";

export interface WidgetSize {
  cols: number;
  rows: number;
}

export type SignalType =
  | "uint8"
  | "int8"
  | "uint16"
  | "int16"
  | "uint32"
  | "int32"
  | "float"
  | "double";

export interface FrameSignal {
  name: string;
  start_byte: number;
  length: number;
  type: SignalType;
  scale: number;
  offset: number;
}

export interface FrameDefinition {
  can_id_label: string;
  signals: FrameSignal[];
}

// key = "0x..." hex string
export type FrameParserConfig = Record<string, FrameDefinition>;

// Data field types are free strings for now (any unit label the user wants).
// The union below is kept for future use when we want to enforce specific types again.
export type DataFieldType = string;
// export type DataFieldType = "temperature" | "pressure" | "rpm";

// Mirror graphics.types.ts GraphMode
export type graphMode = "time_series" | "xy"

// graph settings
export interface GraphInfo {
    mode: graphMode,
    window_seconds?: number,
    max_points: number,

    // XY secondary CAN ID data
    x_can_id?: number,
    x_signal?: string,
    x_unit?: DataFieldType,
    x_min?: number,
    x_max?: number
}

export interface PlacedWidget {
  id: string;
  type: WidgetType;
  col: number; // 0-based grid column
  row: number; // 0-based grid row
  cols: number; // width in cells
  rows: number; // height in cells
  alarm?: boolean;
  widgetCanId?: string;    // hex string like "0x100", references a key in frameParserConfig
  widgetSignal?: string;   // signal name within that CAN frame
  widgetUnit?: string;
  widgetMin?: number;
  widgetMax?: number;
  widgetCautionThreshold?: number;
  widgetCriticalThreshold?: number;
  graphConfig?: GraphInfo
}

export interface ScreenState {
  id: string;
  name: string;
  originalName?: string; // Track original name from localStorage for rename/replace
  widgets: PlacedWidget[];
  isDirty?: boolean; // Track if screen has unsaved changes
}

export interface EditorState {
  screens: ScreenState[];
  activeScreenId: string;
  selectedWidgetId: string | null;
  frameParserConfig: FrameParserConfig;
  canIdsDirty: boolean;
}

export interface SavedLayout {
  name: string;
  widgets: PlacedWidget[];
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

export interface LiveLogLine {
  ts: number;
  key: string;
  value: number;
}

export type EditorAction =
  | { type: "ADD_WIDGET"; payload: PlacedWidget }
  | { type: "MOVE_WIDGET"; payload: { id: string; col: number; row: number } }
  | { type: "RESIZE_WIDGET"; payload: { id: string; cols: number; rows: number } }
  | { type: "REMOVE_WIDGET"; payload: { id: string } }
  | { type: "SELECT_WIDGET"; payload: { id: string | null } }
  | {
      type: "UPDATE_WIDGET_DATA";
      payload: {
        id: string;
        alarm?: boolean;
        widgetCanId?: string;
        widgetSignal?: string;
        widgetUnit?: string;
        widgetMin?: number;
        widgetMax?: number;
        widgetCautionThreshold?: number;
        widgetCriticalThreshold?: number;
        graphConfig?: GraphInfo;
      };
    }
  | { type: "CLEAR_SCREEN" }
  | { type: "ADD_SCREEN" }
  | { type: "REMOVE_SCREEN"; payload: { id: string } }
  | { type: "SET_ACTIVE_SCREEN"; payload: { id: string } }
  | { type: "SET_SCREEN_NAME"; payload: { id: string; name: string } }
  | { type: "UPDATE_ORIGINAL_NAME"; payload: { id: string; originalName: string } }
  | { type: "MARK_CLEAN"; payload: { id: string } }
  | { type: "LOAD_SCREEN"; payload: SavedLayout }
  | { type: "SET_FRAME_PARSER_CONFIG"; payload: { config: FrameParserConfig } }
  | { type: "ADD_CAN_FRAME"; payload: { canId: string; frame: FrameDefinition } }
  | { type: "UPDATE_CAN_FRAME"; payload: { canId: string; frame: FrameDefinition } }
  | { type: "REMOVE_CAN_FRAME"; payload: { canId: string } }
  | { type: "MARK_CAN_IDS_CLEAN" };
