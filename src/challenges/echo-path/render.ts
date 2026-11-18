/**
 * Echo Path's canvas (T189): a tall board whose bottom row is the start and top row the goal, the
 * playback with a fading trail so the path reads as a line, the cleared path shown briefly after
 * a clear, the player's presses and a miss. Row 0 is drawn at the bottom.
 */

export type EchoPathColors = {
  board: string;
  tile: string;
  lit: string;
  trail: string;
  pressed: string;
  miss: string;
  start: string;
  finish: string;
  focus: string;
};

/** A tile drawn in the trail colour at this strength (0 to 1). */
export type TrailTile = { tile: number; strength: number };

export type EchoPathFrame = {
  cols: number;
  rows: number;
  /** Canvas size in CSS pixels; the board keeps its shape and is centred in it. */
  width: number;
  height: number;
  devicePixelRatio: number;
  /** The tile lit by the playback, or null. */
  lit: number | null;
  /** Tiles of the playback already shown, or of the path just cleared, fading. */
  trail: readonly TrailTile[];
  /** The tile the player just pressed, or null. */
  pressed: number | null;
  /** The tile the arrow keys are on, ringed, or null while the player has not used them. */
  focus: number | null;
  /** How strongly the miss tint shows, 0 (none) to 1 (see `missStrength`). */
  miss: number;
  colors: EchoPathColors;
};

/** The gap between tiles and around them, as a share of a tile's side. */
export const TILE_GAP = 0.1;
/** Each playback step lights its tile for this share of `stepMs`, then a short dark gap. */
export const LIT_SHARE = 0.75;
/** How many steps a tile of the trail takes to fade out behind the playback. */
export const TRAIL_STEPS = 4;
/** The trail's strength right behind the lit tile. */
export const TRAIL_MAX = 0.6;
/** How long the cleared path shows after a clear. */
export const CLEARED_MS = 500;
/** How long the miss tint takes to fade. */
export const MISS_FLASH_MS = 400;
/** The start and goal marks' thickness, as a share of the gap around the board. */
const MARK_SHARE = 0.6;

export type BoardLayout = { left: number; top: number; gap: number; tileSize: number; cols: number; rows: number };

/** Where the tiles sit on a canvas of this size (CSS pixels): as large as fits, centred. */
export function boardLayout(width: number, height: number, cols: number, rows: number): BoardLayout {
  const tileSize = Math.min(width / (cols + (cols + 1) * TILE_GAP), height / (rows + (rows + 1) * TILE_GAP));
  const gap = tileSize * TILE_GAP;
  const boardWidth = cols * tileSize + (cols + 1) * gap;
  const boardHeight = rows * tileSize + (rows + 1) * gap;
  return { left: (width - boardWidth) / 2, top: (height - boardHeight) / 2, gap, tileSize, cols, rows };
}

const boardSize = (layout: BoardLayout) => ({
  width: layout.cols * layout.tileSize + (layout.cols + 1) * layout.gap,
  height: layout.rows * layout.tileSize + (layout.rows + 1) * layout.gap,
});

const tileOrigin = (layout: BoardLayout, tile: number) => ({
  x: layout.left + layout.gap + (tile % layout.cols) * (layout.tileSize + layout.gap),
  y: layout.top + layout.gap + (layout.rows - 1 - Math.floor(tile / layout.cols)) * (layout.tileSize + layout.gap),
});

/** The tile under a canvas point (CSS pixels), or null in the gaps and off the board. */
export function hitTile(layout: BoardLayout, x: number, y: number): number | null {
  const pitch = layout.tileSize + layout.gap;
  const col = Math.floor((x - layout.left - layout.gap) / pitch);
  const fromTop = Math.floor((y - layout.top - layout.gap) / pitch);
  if (col < 0 || fromTop < 0 || col >= layout.cols || fromTop >= layout.rows) return null;
  const tile = (layout.rows - 1 - fromTop) * layout.cols + col;
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

/**
 * The tiles behind the playback `elapsedMs` after it starts: each one already shown fades from
 * TRAIL_MAX over TRAIL_STEPS steps, so the last few read as a line. Under reduced motion every
 * tile shown stays at TRAIL_MAX, without the fade, until the playback ends.
 */
export function trailAt(sequence: readonly number[], stepMs: number, elapsedMs: number, reducedMotion: boolean): TrailTile[] {
  if (elapsedMs < 0 || elapsedMs >= playbackMs(sequence.length, stepMs)) return [];
  const step = Math.floor(elapsedMs / stepMs);
  return sequence.slice(0, step).flatMap((tile, i) => {
    // How many steps ago this tile's own step ended.
    const age = (elapsedMs - (i + 1) * stepMs) / stepMs;
    const strength = reducedMotion ? TRAIL_MAX : TRAIL_MAX * (1 - age / TRAIL_STEPS);
    return strength > 0 ? [{ tile, strength }] : [];
  });
}

/** The path just cleared, `msSinceClear` after the clear: fading out, or held whole under reduced motion. */
export function clearedTrail(tiles: readonly number[], msSinceClear: number | null, reducedMotion: boolean): TrailTile[] {
  if (msSinceClear === null || msSinceClear < 0 || msSinceClear >= CLEARED_MS) return [];
  const strength = reducedMotion ? 1 : 1 - msSinceClear / CLEARED_MS;
  return tiles.map((tile) => ({ tile, strength }));
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
  const board = boardSize(layout);
  ctx.fillStyle = colors.board;
  ctx.fillRect(layout.left, layout.top, board.width, board.height);
  if (frame.miss > 0) {
    ctx.globalAlpha = frame.miss;
    ctx.fillStyle = colors.miss;
    ctx.fillRect(layout.left, layout.top, board.width, board.height);
    ctx.globalAlpha = 1;
  }
  // The goal mark along the top edge, the start mark along the bottom.
  const mark = layout.gap * MARK_SHARE;
  ctx.fillStyle = colors.finish;
  ctx.fillRect(layout.left + layout.gap, layout.top + (layout.gap - mark) / 2, board.width - 2 * layout.gap, mark);
  ctx.fillStyle = colors.start;
  ctx.fillRect(layout.left + layout.gap, layout.top + board.height - (layout.gap + mark) / 2, board.width - 2 * layout.gap, mark);

  const trail = new Map(frame.trail.map(({ tile, strength }) => [tile, strength]));
  for (let tile = 0; tile < frame.cols * frame.rows; tile++) {
    const { x, y } = tileOrigin(layout, tile);
    if (tile === frame.focus) {
      // A ring in the gap around the tile, drawn under it.
      ctx.fillStyle = colors.focus;
      ctx.fillRect(x - layout.gap / 2, y - layout.gap / 2, layout.tileSize + layout.gap, layout.tileSize + layout.gap);
    }
    ctx.fillStyle = tile === frame.lit ? colors.lit : tile === frame.pressed ? colors.pressed : colors.tile;
    ctx.fillRect(x, y, layout.tileSize, layout.tileSize);
    const strength = trail.get(tile);
    if (strength !== undefined && tile !== frame.lit && tile !== frame.pressed) {
      ctx.globalAlpha = strength;
      ctx.fillStyle = colors.trail;
      ctx.fillRect(x, y, layout.tileSize, layout.tileSize);
      ctx.globalAlpha = 1;
    }
  }
}
