import type { WidgetType, WidgetSize } from "../types";

export const GRID_COLS = 10;
export const GRID_ROWS = 6;

export const defaultSize: Record<WidgetType, WidgetSize> = {
  gauge: { cols: 2, rows: 2 },
  number: { cols: 2, rows: 1 },
  bar: { cols: 3, rows: 1 },
  graph: { cols: 4, rows: 2 },
  indicator: { cols: 1, rows: 1 },
};

export const allowedSizes: Record<WidgetType, WidgetSize[]> = {
  gauge: [
    { cols: 2, rows: 2 },
    { cols: 3, rows: 3 },
  ],
  number: [
    { cols: 1, rows: 1 },
    { cols: 2, rows: 1 },
    { cols: 3, rows: 1 },
  ],
  bar: [
    { cols: 2, rows: 1 },
    { cols: 3, rows: 1 },
    { cols: 4, rows: 1 },
    { cols: 1, rows: 2 },
    { cols: 1, rows: 3 },
  ],
  graph: [
    { cols: 3, rows: 2 },
    { cols: 4, rows: 2 },
    { cols: 5, rows: 3 },
  ],
  indicator: [{ cols: 1, rows: 1 }],
};
