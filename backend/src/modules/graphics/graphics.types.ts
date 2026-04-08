export interface GraphicsConfig {
    screens: ScreenInfo[]
}

export interface ScreenInfo {
    name: string,
    widgets: WidgetInfo[]
}

export interface WidgetInfo {
    type: WidgetType,
    alarm: boolean,
    position: positionInfo,
    data: dataInfo,
    graph?: graphInfo
}

export enum WidgetType {
    Gauge = "gauge",
    Bar = "bar",
    Number = "number",
    Indicator = "indicator",
    Graph = "graph"
}

export interface positionInfo {
    x: number,
    y: number,
    width: number,
    height: number
}

export interface dataInfo {
    can_id: number,
    can_id_label: string,
    signal: string,
    unit: DataFieldType,
    min: number,
    max: number,
    caution_threshold: number,
    critical_threshold: number
}

export enum GraphMode {
    TimeSeries = "time_series",
    XY = "xy"
}

export interface graphInfo {
    mode: GraphMode,
    window_seconds?: number,
    max_points: number,

    // XY secondary CAN ID data
    x_can_id?: number,
    x_signal?: string,
    x_unit?: DataFieldType,
    x_min?: number,
    x_max?: number
}

// Data field types are free strings for now (any unit label the user wants).
// The enum below is kept for future use when we want to enforce specific types again.
export type DataFieldType = string;
// export enum DataFieldType {
//     Temperature = "temperature",
//     Pressure = "pressure",
//     RPM = "rpm"
// }
