import { createRng, type Rng } from "../shared/prng";

/**
 * Echo Path's path (T187): one contiguous line of tiles from the bottom row of a tall, narrow
 * board to its top row. Tiles are numbered row by row from the bottom: index = row * COLS + col.
 * The owner's rules: each step goes to an adjacent tile, straight forward, diagonally forward or
 * sideways (never back), with no move more than twice in a row, and a fixed maximum length. Never
 * visiting a tile twice is the reading of "contiguous" (M6 notes). 5 columns and the minimum are
 * proposed, owner to confirm (DECISIONS).
 */

export const COLS = 5;
export const ROWS = 10;
export const MAX_PATH_LENGTH = 18;
export const MIN_PATH_LENGTH = 12;
/** Seeded walks tried for one that reaches the minimum, before the fixed fallback. */
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

/** The move from one tile to the next, or null if no single move gets there. */
function moveBetween(from: number, to: number): Move | null {
  const rows = rowOf(to) - rowOf(from);
  const cols = colOf(to) - colOf(from);
  return MOVE_NAMES.find((move) => MOVES[move][0] === rows && MOVES[move][1] === cols) ?? null;
}

/** One seeded walk from a bottom-row column to the first top-row tile, obeying every rule but the minimum. */
function walk(rng: Rng, startCol: number): number[] {
  const path = [tileAt(0, startCol)];
  const moves: Move[] = [];
  let sideways = 0;
  while (rowOf(path.at(-1)!) < ROWS - 1) {
    const here = path.at(-1)!;
    const repeated = moves.length >= MAX_SAME_MOVE && moves.slice(-MAX_SAME_MOVE).every((move) => move === moves.at(-1));
    // Never stuck: forward or one of the diagonals is always on the board and above every visited row.
    const allowed = MOVE_NAMES.filter((move) => {
      const [dRow, dCol] = MOVES[move];
      const col = colOf(here) + dCol;
      if (col < 0 || col >= COLS) return false;
      if (repeated && move === moves.at(-1)) return false;
      if (isSideways(move) && sideways >= MAX_SIDEWAYS) return false;
      return !path.includes(tileAt(rowOf(here) + dRow, col));
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
 * A fixed path of 13 tiles that keeps every rule, for the rare seed whose walks all stay short:
 * a zigzag in the first three rows, then forward and diagonal steps in turn within two columns.
 */
export function fallbackPath(startCol: number): number[] {
  const toward = startCol < COLS - 1 ? 1 : -1;
  const side: Move = toward === 1 ? "right" : "left";
  const back: Move = toward === 1 ? "left" : "right";
  const diagonalBack: Move = toward === 1 ? "forwardLeft" : "forwardRight";
  const diagonalOn: Move = toward === 1 ? "forwardRight" : "forwardLeft";
  const moves: Move[] = [side, "forward", back, "forward", side, "forward", diagonalBack, "forward", diagonalOn, "forward", diagonalBack, "forward"];
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
    if (path.length >= MIN_PATH_LENGTH) return path;
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
  return moves.every((move, i) => i < MAX_SAME_MOVE || moves.slice(i - MAX_SAME_MOVE, i).some((earlier) => earlier !== move));
}
