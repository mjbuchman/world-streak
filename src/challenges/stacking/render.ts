import { COLUMNS, ROWS, columnAt, type StackingParams, type StackingResult } from "./engine";

/** The gap between cells, as a fraction of a cell. */
export const CELL_GAP = 0.12;

/** Corner radius of a game cell in CSS px (matches `--fs-radius-cell`, UI_GUIDELINES rule 6). */
export const CELL_RADIUS_PX = 8;

/** How long a cell that hangs over the edge takes to fall away, in ms. */
export const FALL_MS = 400;
/** How far it falls in that time, in cells. */
const FALL_CELLS = 3;

/** The short lift a row gives when it lands, in ms and cells. */
export const BOUNCE_MS = 180;
const BOUNCE_CELLS = 0.18;

/** The line along the top of the pass row: thickness in cells and opacity. */
export const TARGET_LINE = { thickness: 0.08, alpha: 0.7 } as const;

export type StackingColors = { empty: string; tower: string; moving: string; falling: string; target: string };

export type StackingFrame = {
  params: StackingParams;
  result: StackingResult;
  elapsedMs: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  devicePixelRatio: number;
  colors: StackingColors;
  /** Today's pass row; the line is drawn along its top. Left out in practice. */
  passTarget?: number;
  /** No falling or bounce animation (prefers-reduced-motion). */
  reducedMotion?: boolean;
};

export type FallingCell = { column: number; row: number; drop: number; alpha: number };

/**
 * The cells that fell off a locked row and are still falling at `elapsedMs`: `drop` cells below
 * their row (accelerating, like gravity) and fading out. Pure, so the animation follows the
 * engine's lock times exactly and never depends on the frame rate.
 */
export function fallingCells(result: StackingResult, elapsedMs: number): FallingCell[] {
  return result.rows.flatMap((placed, i) => {
    const t = elapsedMs - placed.lockedAtMs;
    if (t < 0 || t >= FALL_MS) return [];
    const progress = t / FALL_MS;
    return placed.lostColumns.map((column) => ({
      column,
      row: i + 1,
      drop: FALL_CELLS * progress * progress,
      alpha: 1 - progress,
    }));
  });
}

/** The row that just landed and how far it is lifted (a half sine), or null once it has settled. */
export function landingLift(result: StackingResult, elapsedMs: number): { row: number; lift: number } | null {
  const last = result.rows.at(-1);
  // A row that dropped by itself, or a miss, has nothing to bounce.
  if (!last || !last.byTap || last.width === 0) return null;
  const t = elapsedMs - last.lockedAtMs;
  if (t < 0 || t >= BOUNCE_MS) return null;
  return { row: result.rows.length, lift: BOUNCE_CELLS * Math.sin((Math.PI * t) / BOUNCE_MS) };
}

/**
 * Draws one frame of the grid. The transform makes one unit one cell (the board is COLUMNS
 * cells wide), so drawing below is in cells, row 1 at the bottom.
 */
export function drawStacking(ctx: CanvasRenderingContext2D, frame: StackingFrame): void {
  const { params, result, elapsedMs, width, height, devicePixelRatio, colors, passTarget, reducedMotion = false } = frame;
  const scale = (width / COLUMNS) * devicePixelRatio;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const fieldHeight = (height / width) * COLUMNS;
  // Clear first: the cells are translucent, and the page shows through the gaps.
  ctx.clearRect(0, 0, COLUMNS, fieldHeight);

  // Drawing is in cells, so convert the radius from CSS px; never more than half a cell.
  const size = 1 - CELL_GAP;
  const radius = Math.min(CELL_RADIUS_PX / (width / COLUMNS), size / 2);
  // `row` may be fractional while a cell moves (falling, or lifted on landing).
  const cell = (column: number, row: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(column + CELL_GAP / 2, fieldHeight - row + CELL_GAP / 2, size, size, radius);
    ctx.fill();
  };

  for (let row = 1; row <= ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) cell(column, row, colors.empty);
  }

  if (passTarget !== undefined) {
    ctx.globalAlpha = TARGET_LINE.alpha;
    ctx.fillStyle = colors.target;
    ctx.fillRect(0, fieldHeight - passTarget - TARGET_LINE.thickness / 2, COLUMNS, TARGET_LINE.thickness);
    ctx.globalAlpha = 1;
  }

  const landing = reducedMotion ? null : landingLift(result, elapsedMs);
  result.rows.forEach((placed, i) => {
    const row = i + 1;
    const lift = landing?.row === row ? landing.lift : 0;
    for (let c = 0; c < placed.width; c++) cell(placed.left + c, row + lift, colors.tower);
  });

  if (!reducedMotion) {
    for (const falling of fallingCells(result, elapsedMs)) {
      ctx.globalAlpha = falling.alpha;
      cell(falling.column, falling.row - falling.drop, colors.falling);
    }
    ctx.globalAlpha = 1;
  }

  if (result.moving) {
    const left = columnAt(params, result.moving, elapsedMs);
    for (let c = 0; c < result.moving.width; c++) cell(left + c, result.moving.row, colors.moving);
  }
}
