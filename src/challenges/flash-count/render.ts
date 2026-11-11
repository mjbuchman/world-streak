import type { Dot } from "./engine";

export type FlashCountFrame = {
  dots: Dot[];
  /** Whether the dots are on screen (the flash), or the board is clear. */
  showDots: boolean;
  /** Canvas size in CSS pixels; the board is a square of the smaller side. */
  width: number;
  height: number;
  devicePixelRatio: number;
  colors: { board: string; dot: string };
};

/**
 * The dots' square sits this far inside the board (a fraction of its side), so a dot in a corner
 * is never cut by the board's rounded corners.
 */
export const BOARD_PADDING = 0.06;

/** Whether the flash is still on at `elapsedMs` since the dots first appeared (time, never frames). */
export function dotsVisible(elapsedMs: number, flashMs: number): boolean {
  return elapsedMs < flashMs;
}

/** Draws the board, and the dots while they are shown. Positions are in a unit square. */
export function drawFlashCount(ctx: CanvasRenderingContext2D, frame: FlashCountFrame): void {
  const { width, height, devicePixelRatio, colors } = frame;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const side = Math.min(width, height);
  const left = (width - side) / 2;
  const top = (height - side) / 2;
  ctx.fillStyle = colors.board;
  ctx.fillRect(left, top, side, side);
  if (!frame.showDots) return;
  const inset = side * BOARD_PADDING;
  const field = side - 2 * inset;
  ctx.fillStyle = colors.dot;
  for (const dot of frame.dots) {
    ctx.beginPath();
    ctx.arc(left + inset + dot.x * field, top + inset + dot.y * field, dot.r * field, 0, 2 * Math.PI);
    ctx.fill();
  }
}
