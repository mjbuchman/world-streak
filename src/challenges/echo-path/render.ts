/** Echo Path's canvas: the grid of tiles, the playback, the player's presses and a miss. */

export type EchoPathColors = { board: string; tile: string; lit: string; pressed: string; miss: string };

export type EchoPathFrame = {
  cols: number;
  rows: number;
  /** Canvas size in CSS pixels; the board is a square of the smaller side. */
  width: number;
  height: number;
  devicePixelRatio: number;
  /** The tile lit by the playback, or null. */
  lit: number | null;
  /** The tile the player just pressed, or null. */
  pressed: number | null;
  /** How strongly the miss tint shows, 0 (none) to 1 (see `missStrength`). */
  miss: number;
  colors: EchoPathColors;
};

/** The gap between tiles and around them, as a share of the board's side. */
export const TILE_GAP = 0.04;
/** Each playback step lights its tile for this share of `stepMs`, then a short dark gap. */
export const LIT_SHARE = 0.75;
/** How long the miss tint takes to fade. */
export const MISS_FLASH_MS = 400;

export type BoardLayout = { left: number; top: number; gap: number; tileSize: number; cols: number; rows: number };

/** Where the tiles sit on a canvas of this size (CSS pixels). */
export function boardLayout(width: number, height: number, cols: number, rows: number): BoardLayout {
  const side = Math.min(width, height);
  const gap = side * TILE_GAP;
  const tileSize = (side - (Math.max(cols, rows) + 1) * gap) / Math.max(cols, rows);
  return { left: (width - side) / 2, top: (height - side) / 2, gap, tileSize, cols, rows };
}

const tileOrigin = (layout: BoardLayout, tile: number) => ({
  x: layout.left + layout.gap + (tile % layout.cols) * (layout.tileSize + layout.gap),
  y: layout.top + layout.gap + Math.floor(tile / layout.cols) * (layout.tileSize + layout.gap),
});

/** The tile under a canvas point (CSS pixels), or null in the gaps and outside the grid. */
export function hitTile(layout: BoardLayout, x: number, y: number): number | null {
  const pitch = layout.tileSize + layout.gap;
  const col = Math.floor((x - layout.left - layout.gap) / pitch);
  const row = Math.floor((y - layout.top - layout.gap) / pitch);
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return null;
  const tile = row * layout.cols + col;
  const origin = tileOrigin(layout, tile);
  return x - origin.x < layout.tileSize && y - origin.y < layout.tileSize ? tile : null;
}

/** The tile the playback lights `elapsedMs` after it starts (time, never frames), or null between steps and after the last. */
export function litTileAt(sequence: readonly number[], stepMs: number, elapsedMs: number): number | null {
  if (elapsedMs < 0) return null;
  const step = Math.floor(elapsedMs / stepMs);
  if (step >= sequence.length) return null;
  return elapsedMs - step * stepMs < LIT_SHARE * stepMs ? sequence[step] : null;
}

/** How long a playback lasts. */
export const playbackMs = (length: number, stepMs: number) => length * stepMs;

/** The miss tint `msSinceMiss` after a miss: fading out, or held whole without animation under reduced motion. */
export function missStrength(msSinceMiss: number | null, reducedMotion: boolean): number {
  if (msSinceMiss === null || msSinceMiss < 0 || msSinceMiss >= MISS_FLASH_MS) return 0;
  return reducedMotion ? 1 : 1 - msSinceMiss / MISS_FLASH_MS;
}

export function drawEchoPath(ctx: CanvasRenderingContext2D, frame: EchoPathFrame): void {
  const { width, height, devicePixelRatio, colors } = frame;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const layout = boardLayout(width, height, frame.cols, frame.rows);
  const side = Math.min(width, height);
  ctx.fillStyle = colors.board;
  ctx.fillRect(layout.left, layout.top, side, side);
  if (frame.miss > 0) {
    ctx.globalAlpha = frame.miss;
    ctx.fillStyle = colors.miss;
    ctx.fillRect(layout.left, layout.top, side, side);
    ctx.globalAlpha = 1;
  }
  for (let tile = 0; tile < frame.cols * frame.rows; tile++) {
    const { x, y } = tileOrigin(layout, tile);
    ctx.fillStyle = tile === frame.lit ? colors.lit : tile === frame.pressed ? colors.pressed : colors.tile;
    ctx.fillRect(x, y, layout.tileSize, layout.tileSize);
  }
}
