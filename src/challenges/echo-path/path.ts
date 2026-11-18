import { createRng, type Rng } from "../shared/prng";

/**
 * Trail Trace's path (T187, T207): one contiguous line of tiles from the bottom row of a narrow
 * board to its top row. Tiles are numbered row by row from the bottom: index = row * COLS + col.
 * The owner's rules: each step goes to an adjacent tile, straight forward, diagonally forward or
 * sideways (never back), with no move more than twice in a row, at most 12 tiles, and no three
 * tiles touching, where touching is sharing an edge (Nov 18). Three tiles can never all share
 * edges with each other, so that reads as: a tile shares an edge only with the tiles just before
 * and after it, which rules out a cutback alongside an earlier tile. Never visiting a tile twice
 * is the reading of "contiguous" (M6 notes). 5 x 8 is the owner's board (Nov 18); the minimum
 * is a straight-up climb's length.
 */

export const COLS = 5;
export const ROWS = 8;
export const MAX_PATH_LENGTH = 12;
export const MIN_PATH_LENGTH = ROWS;
/** Seeded walks tried for a valid one, before the fixed fallback. */
export const PATH_TRIES = 20;

/** Rows and columns each move adds. Forward is up the board (row + 1). */
const MOVES = {
  forward: [1, 0],
  forwardLeft: [1, -1],
  forwardRight: [1, 1],
  left: [0, -1],
  right: [0, 1],
} as const;
type Move = keyof typeof MOVES;
const MOVE_NAMES = Object.keys(MOVES) as Move[];
const MAX_SAME_MOVE = 2;
/** Every row past the first costs one forward step, so the rest of the length is sideways steps. */
const MAX_SIDEWAYS = MAX_PATH_LENGTH - ROWS;

const tileAt = (row: number, col: number) => row * COLS + col;
const rowOf = (tile: number) => Math.floor(tile / COLS);
const colOf = (tile: number) => tile % COLS;
const isSideways = (move: Move) => MOVES[move][0] === 0;
const sharesEdge = (a: number, b: number) => Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;

/** The move from one tile to the next, or null if no single move gets there. */
function moveBetween(from: number, to: number): Move | null {
  const rows = rowOf(to) - rowOf(from);
  const cols = colOf(to) - colOf(from);
  return MOVE_NAMES.find((move) => MOVES[move][0] === rows && MOVES[move][1] === cols) ?? null;
}

/** One seeded walk from a bottom-row column to the first top-row tile. */
function walk(rng: Rng, startCol: number): number[] {
  const path = [tileAt(0, startCol)];
  const moves: Move[] = [];
  let sideways = 0;
  while (rowOf(path.at(-1)!) < ROWS - 1) {
    const here = path.at(-1)!;
    const repeated = moves.length >= MAX_SAME_MOVE && moves.slice(-MAX_SAME_MOVE).every((move) => move === moves.at(-1));
    // Never stuck: the row above holds no path tile yet, so forward, or a diagonal when forward
    // has been used twice, is always on the board and touches nothing but `here`.
    const allowed = MOVE_NAMES.filter((move) => {
      const [dRow, dCol] = MOVES[move];
      const col = colOf(here) + dCol;
      if (col < 0 || col >= COLS) return false;
      if (repeated && move === moves.at(-1)) return false;
      if (isSideways(move) && sideways >= MAX_SIDEWAYS) return false;
      const next = tileAt(rowOf(here) + dRow, col);
      return !path.some((tile) => tile === next || (tile !== here && sharesEdge(tile, next)));
    });
    const move = rng.pick(allowed);
    const [dRow, dCol] = MOVES[move];
    path.push(tileAt(rowOf(here) + dRow, colOf(here) + dCol));
    moves.push(move);
    if (isSideways(move)) sideways++;
  }
  return path;
}

/**
 * A fixed path of 8 tiles that keeps every rule. A straight column would be three forward moves
 * in a row, so it climbs two rows, steps diagonally, climbs two more and steps back.
 */
export function fallbackPath(startCol: number): number[] {
  const toward = startCol < COLS - 1 ? 1 : -1;
  const diagonalOn: Move = toward === 1 ? "forwardRight" : "forwardLeft";
  const diagonalBack: Move = toward === 1 ? "forwardLeft" : "forwardRight";
  const moves: Move[] = ["forward", "forward", diagonalOn, "forward", "forward", diagonalBack, "forward"];
  const path = [tileAt(0, startCol)];
  for (const move of moves) {
    const here = path.at(-1)!;
    path.push(tileAt(rowOf(here) + MOVES[move][0], colOf(here) + MOVES[move][1]));
  }
  return path;
}

/** The path for a seed: the same every time, different across seeds. `tries` is for tests of the fallback. */
export function pathFor(seed: number, tries = PATH_TRIES): number[] {
  const rng = createRng(seed);
  const startCol = rng.int(0, COLS - 1);
  for (let i = 0; i < tries; i++) {
    const path = walk(rng, startCol);
    if (isValidPath(path)) return path;
  }
  return fallbackPath(startCol);
}

/** Whether a path keeps every rule above; the tests check generated and hand-built paths with it. */
export function isValidPath(path: readonly number[]): boolean {
  if (path.length < MIN_PATH_LENGTH || path.length > MAX_PATH_LENGTH) return false;
  if (path.some((tile) => !Number.isInteger(tile) || tile < 0 || tile >= COLS * ROWS)) return false;
  if (new Set(path).size !== path.length) return false;
  if (rowOf(path[0]) !== 0) return false;
  // Ends the first time it reaches the top row.
  if (path.findIndex((tile) => rowOf(tile) === ROWS - 1) !== path.length - 1) return false;
  const moves = path.slice(1).map((tile, i) => moveBetween(path[i], tile));
  if (moves.some((move) => move === null)) return false;
  if (path.some((tile, i) => path.slice(i + 2).some((later) => sharesEdge(tile, later)))) return false;
  return moves.every((move, i) => i < MAX_SAME_MOVE || moves.slice(i - MAX_SAME_MOVE, i).some((earlier) => earlier !== move));
}
