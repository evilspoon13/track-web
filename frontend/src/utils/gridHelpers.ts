import type { PlacedWidget } from "../types";
import { GRID_COLS, GRID_ROWS } from "./widgetDefaults";

export function pixelToGrid(
  px: number,
  py: number,
  cellWidth: number,
  cellHeight: number
): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(px / cellWidth))),
    row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(py / cellHeight))),
  };
}

export function hasCollision(
  col: number,
  row: number,
  cols: number,
  rows: number,
  widgets: PlacedWidget[],
  excludeId?: string
): boolean {
  if (col < 0 || row < 0 || col + cols > GRID_COLS || row + rows > GRID_ROWS) {
    return true;
  }

  return widgets.some((w) => {
    if (w.id === excludeId) return false;
    const noOverlap =
      col >= w.col + w.cols ||
      col + cols <= w.col ||
      row >= w.row + w.rows ||
      row + rows <= w.row;
    return !noOverlap;
  });
}

export function clampToGrid(
  col: number,
  row: number,
  cols: number,
  rows: number
): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(GRID_COLS - cols, col)),
    row: Math.max(0, Math.min(GRID_ROWS - rows, row)),
  };
}
