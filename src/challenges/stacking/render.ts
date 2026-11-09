import { COLUMNS, ROWS, columnAt, type StackingParams, type StackingResult } from "./engine";

/** The gap between cells, as a fraction of a cell. */
export const CELL_GAP = 0.12;

export type StackingColors = { empty: string; tower: string; moving: string };

export type StackingFrame = {
  params: StackingParams;
  result: StackingResult;
  elapsedMs: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  devicePixelRatio: number;
  colors: StackingColors;
};

/**
 * Draws one frame of the grid. The transform makes one unit one cell (the board is COLUMNS
 * cells wide), so drawing below is in cells, row 1 at the bottom.
 */
export function drawStacking(ctx: CanvasRenderingContext2D, frame: StackingFrame): void {
  const { params, result, elapsedMs, width, height, devicePixelRatio, colors } = frame;
  const scale = (width / COLUMNS) * devicePixelRatio;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const fieldHeight = (height / width) * COLUMNS;
  // Clear first: the cells are translucent, and the page shows through the gaps.
  ctx.clearRect(0, 0, COLUMNS, fieldHeight);

  const cell = (column: number, row: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(column + CELL_GAP / 2, fieldHeight - row + CELL_GAP / 2, 1 - CELL_GAP, 1 - CELL_GAP);
  };

  for (let row = 1; row <= ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) cell(column, row, colors.empty);
  }
  result.rows.forEach((placed, i) => {
    for (let c = 0; c < placed.width; c++) cell(placed.left + c, i + 1, colors.tower);
  });
  if (result.moving) {
    const left = columnAt(params, result.moving, elapsedMs);
    for (let c = 0; c < result.moving.width; c++) cell(left + c, result.moving.row, colors.moving);
  }
}
