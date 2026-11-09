import { BASE_BLOCK, FIELD_WIDTH, blockLeftAt, type StackingParams, type StackingResult } from "./engine";

/** Height of one block, in the engine's logical units (the field is 400 units wide). */
export const BLOCK_HEIGHT = 20;

/** Rows kept free above the moving block once the tower reaches the top of the view. */
const HEADROOM_ROWS = 2;

export type StackingColors = { background: string; base: string; tower: string; moving: string };

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
 * Draws one frame. The canvas backing store is `width * devicePixelRatio` pixels wide; the
 * transform maps the 400-unit field onto it, so drawing below is in engine units.
 */
export function drawStacking(ctx: CanvasRenderingContext2D, frame: StackingFrame): void {
  const { params, result, elapsedMs, width, height, devicePixelRatio, colors } = frame;
  const scale = (width / FIELD_WIDTH) * devicePixelRatio;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const fieldHeight = (height / width) * FIELD_WIDTH;
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, FIELD_WIDTH, fieldHeight);

  // Row 0 is the base. Once the tower nears the top, scroll so the moving row stays in view.
  const visibleRows = Math.floor(fieldHeight / BLOCK_HEIGHT);
  const topRow = result.blocks.length + 1;
  const scrolledRows = Math.max(0, topRow - (visibleRows - 1 - HEADROOM_ROWS));
  const rowTop = (row: number) => fieldHeight - (row + 1 - scrolledRows) * BLOCK_HEIGHT;

  const drawRow = (row: number, left: number, blockWidth: number, color: string) => {
    if (row < scrolledRows) return; // scrolled out of view below
    ctx.fillStyle = color;
    ctx.fillRect(left, rowTop(row), blockWidth, BLOCK_HEIGHT);
  };

  drawRow(0, BASE_BLOCK.left, BASE_BLOCK.width, colors.base);
  result.blocks.forEach((block, i) => drawRow(i + 1, block.left, block.width, colors.tower));
  if (result.moving) {
    drawRow(topRow, blockLeftAt(params, result.moving, elapsedMs), result.moving.width, colors.moving);
  }
}
