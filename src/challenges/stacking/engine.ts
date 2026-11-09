import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Teetering Tower: a column-grid stacker (DECISIONS, "Human decisions at the M1 play-test").
 * A run of cells slides along one row, one column at a time, bouncing between the walls; a tap
 * locks it. Cells that do not rest on a cell of the row below fall off, so the next row starts
 * narrower. The width is also capped at set heights. Score = rows locked (0 to ROWS); locking
 * the top row is the win. No cells left is a miss. There is no time limit.
 *
 * Driven only by elapsed milliseconds since the run started, so the server can replay a run
 * from its taps alone.
 */

export const COLUMNS = 7;
export const ROWS = 15;
export const START_WIDTH = 3;

/** Forced narrowing, like the arcade original: from `fromRow` (1-based) a row is at most `max` wide. */
export const WIDTH_CAPS: readonly { fromRow: number; max: number }[] = [
  { fromRow: 6, max: 2 },
  { fromRow: 11, max: 1 },
];

/** At most one counted tap per row. */
export const MAX_TAPS = ROWS;

/**
 * A row nobody taps for this long drops off the board, which ends the run like a miss
 * (judgment call, see DECISIONS). It keeps every run finite without a time limit, so it can
 * always be replayed and submitted, and nobody scores rows without tapping.
 */
export const IDLE_LOCK_MS = 8_000;

/**
 * Per-player randomization. Row r steps every `startStepMs - stepDecayMs * (r - 1)` ms (never
 * under MIN_STEP_MS). Tuned (tuning.test.ts, DECISIONS) so a decent player reaches about row 10.
 */
export const PARAM_RANGES = {
  startStepMs: { min: 150, max: 170 },
  stepDecayMs: { min: 6, max: 8 },
} as const;
export const MIN_STEP_MS = 45;

export type Direction = "left" | "right";

export type StackingParams = {
  /** Step interval of row 1, in ms. */
  startStepMs: number;
  /** How much shorter each later row's step interval is, in ms. */
  stepDecayMs: number;
  /** Leftmost column of row 1 when it appears. */
  startColumn: number;
  /** Where row 1 first moves; later rows alternate. */
  direction: Direction;
};

export type StackingInputs = { tapsMs: number[] };

/** A locked row: the cells that stayed (columns `left` to `left + width - 1`) and the ones lost. */
export type PlacedRow = { left: number; width: number; lostColumns: number[]; lockedAtMs: number; byTap: boolean };

/** The row in play: row `row` (1-based), `width` cells, appearing at `startMs`. */
export type MovingRow = { row: number; width: number; startMs: number; startColumn: number; direction: Direction };

export type StackingResult = {
  score: number;
  /** Locked rows from the bottom up. The last one may have width 0 (the miss). */
  rows: PlacedRow[];
  endedAtMs: number;
  /**
   * "miss": no cells were left. "top": the top row was locked (the win). "running": the run
   * is still going at the time asked about; only the live game asks before the end.
   */
  endReason: "miss" | "top" | "running";
  /** The row in play; null once the run has ended. */
  moving: MovingRow | null;
};

/** The step interval of `row` (1-based), in ms. */
export function stepMs(params: StackingParams, row: number): number {
  return Math.max(MIN_STEP_MS, params.startStepMs - params.stepDecayMs * (row - 1));
}

/** The widest a row may be. */
export function widthCap(row: number): number {
  return WIDTH_CAPS.reduce((cap, rule) => (row >= rule.fromRow ? Math.min(cap, rule.max) : cap), START_WIDTH);
}

/** Leftmost column of the moving row at `elapsedMs` since the run started. */
export function columnAt(params: StackingParams, moving: MovingRow, elapsedMs: number): number {
  const last = COLUMNS - moving.width;
  if (last === 0) return 0;
  const steps = Math.floor(Math.max(0, elapsedMs - moving.startMs) / stepMs(params, moving.row));
  // Bouncing between 0 and `last` repeats every 2 * last steps; walk it as a phase.
  const period = 2 * last;
  const startPhase = moving.direction === "right" ? moving.startColumn : (period - moving.startColumn) % period;
  const phase = (startPhase + steps) % period;
  return phase <= last ? phase : period - phase;
}

/** Where the row after `locked` appears: at the wall it moves away from, alternating direction. */
function nextRow(params: StackingParams, locked: PlacedRow, row: number, startMs: number): MovingRow {
  const direction: Direction = (params.direction === "right") === (row % 2 === 1) ? "right" : "left";
  const width = Math.min(locked.width, widthCap(row));
  return { row, width, startMs, startColumn: direction === "right" ? 0 : COLUMNS - width, direction };
}

function lock(moving: MovingRow, below: PlacedRow | null, column: number, atMs: number, byTap: boolean): PlacedRow {
  const cells = Array.from({ length: moving.width }, (_, i) => column + i);
  // An untapped row drops off entirely; a tapped one keeps the cells resting on the row below.
  const supported = !byTap ? [] : below ? cells.filter((c) => c >= below.left && c < below.left + below.width) : cells;
  return {
    left: supported[0] ?? column,
    width: supported.length,
    lostColumns: cells.filter((c) => !supported.includes(c)),
    lockedAtMs: atMs,
    byTap,
  };
}

/**
 * Replays a run: the taps (ms since the start, strictly increasing) up to `nowMs`; a row left
 * untapped for IDLE_LOCK_MS drops off and ends the run. The server replays a finished run with
 * `nowMs = Infinity`, which always ends in a miss or the top; the live game passes its clock.
 */
export function simulate(params: StackingParams, tapsMs: readonly number[], nowMs = Number.POSITIVE_INFINITY): StackingResult {
  const rows: PlacedRow[] = [];
  let moving: MovingRow | null = {
    row: 1,
    width: START_WIDTH,
    startMs: 0,
    startColumn: params.startColumn,
    direction: params.direction,
  };
  let endedAtMs = 0;
  let endReason: StackingResult["endReason"] = "running";
  let tapIndex = 0;

  while (moving) {
    const idleAt = moving.startMs + IDLE_LOCK_MS;
    // Taps at or before the row appeared belong to nothing (they cannot happen in a real run).
    while (tapIndex < tapsMs.length && tapsMs[tapIndex] <= moving.startMs) tapIndex++;
    const tap = tapsMs[tapIndex];
    const byTap = tap !== undefined && tap < idleAt && tap <= nowMs;
    const at = byTap ? tap : idleAt;
    if (!byTap && idleAt > nowMs) break; // still waiting for this row's tap
    if (byTap) tapIndex++;

    const locked = lock(moving, rows.at(-1) ?? null, columnAt(params, moving, at), at, byTap);
    rows.push(locked);
    endedAtMs = at;
    if (locked.width === 0) {
      endReason = "miss";
      moving = null;
    } else if (moving.row === ROWS) {
      endReason = "top";
      moving = null;
    } else {
      moving = nextRow(params, locked, moving.row + 1, at);
    }
  }

  const score = rows.filter((row) => row.width > 0).length;
  // While running, endedAtMs is the last lock (never after nowMs); once over, when it ended.
  return { score, rows, endedAtMs, endReason, moving };
}

export function paramsFromSeed(seed: number): StackingParams {
  const rng = createRng(seed);
  const between = ({ min, max }: { min: number; max: number }) => Math.round(min + rng.next() * (max - min));
  return {
    startStepMs: between(PARAM_RANGES.startStepMs),
    // Whole milliseconds, so step boundaries never fall between floating-point values.
    stepDecayMs: between(PARAM_RANGES.stepDecayMs),
    startColumn: rng.int(0, COLUMNS - START_WIDTH),
    direction: rng.pick(["left", "right"] as const),
  };
}

const inputsSchema: z.ZodType<StackingInputs> = z.object({
  tapsMs: z
    // zod 4 numbers already reject NaN and Infinity (tested).
    .array(z.number().nonnegative())
    .max(MAX_TAPS)
    .refine((taps) => taps.every((tap, i) => i === 0 || tap > taps[i - 1]), "Taps must be strictly increasing."),
});

export const stacking: ChallengeModule<StackingParams, StackingInputs> = {
  paramsFromSeed,
  score: (params, inputs) => simulate(params, inputs.tapsMs).score,
  inputsSchema,
  direction: "higher-better",
  lastInputMs: (inputs) => inputs.tapsMs.at(-1) ?? 0,
};
