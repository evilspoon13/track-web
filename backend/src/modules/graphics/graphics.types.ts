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
    data: dataInfo
}

export enum WidgetType {
    Gauge = "gauge",
    Bar = "bar",
    Number = "number",
    Indicator = "indicator"
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

export enum DataFieldType {
    Temperature = "temperature",
    Pressure = "pressure",
    RPM = "rpm"
}

