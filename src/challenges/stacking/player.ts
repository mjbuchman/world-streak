import { createRng } from "../shared/prng";
import { COLUMNS, MAX_TAPS, columnAt, simulate, stepMs, type StackingParams } from "./engine";

// Test support only (tuning, golden fixtures, component and e2e tests): app code must never
// import this module.

const REACTION_MS = 250;

/** How long the simulated player watches a row for a good moment: two full bounces. */
const AIM_STEPS = 4 * COLUMNS;

/**
 * A simulated player for tuning and golden tests. On each row it waits (after a short reaction
 * time) for the run of cells to sit fully over the row below, aims at the middle of that step,
 * and taps with a timing error spread evenly up to `errorMs` either way. Deterministic for a
 * given `seed`. If a row never lines up within two bounces it stops tapping, leaving the run
 * unfinished (there is no time limit).
 */
export function simulatedTaps(params: StackingParams, errorMs: number, seed: number): number[] {
  const rng = createRng(seed);
  const taps: number[] = [];
  while (taps.length < MAX_TAPS) {
    const { moving, rows } = simulate(params, taps, (taps.at(-1) ?? 0) + 1);
    if (!moving) break;
    const below = rows.at(-1);
    // Columns where the whole run rests on the row below (any column for row 1, on the floor).
    const isAligned = (column: number) =>
      !below || (column >= below.left && column + moving.width <= below.left + below.width);
    const step = stepMs(params, moving.row);
    let start = moving.startMs + REACTION_MS;
    start = moving.startMs + Math.ceil((start - moving.startMs) / step) * step; // next step boundary
    let aim = -1;
    for (let i = 0; i < AIM_STEPS; i++) {
      const t = start + step * (i + 0.5);
      if (isAligned(columnAt(params, moving, t))) {
        aim = t;
        break;
      }
    }
    if (aim < 0) break;
    const error = (rng.next() * 2 - 1) * errorMs;
    taps.push(Math.max(moving.startMs + 1, Math.round(aim + error)));
  }
  return taps;
}

/** The deepest search for a miss; narrowing the tower to one cell at an edge takes about three rows. */
const MISS_SEARCH_ROWS = 5;

/**
 * Tap times (whole ms from the start of the run) that end the run with a deliberate miss: a tap
 * that locks a row clear of the tower. Continues from `prefix` (taps already made), tapping no
 * earlier than `fromMs`. Found with the real engine by trying each step of the moving row,
 * shortest sequence first. A centred tower cannot always be missed (a 3-wide row overlaps it
 * everywhere), so the search narrows the tower first.
 */
export function tapsForAMiss(params: StackingParams, prefix: readonly number[] = [], fromMs = 0): number[] {
  if (simulate(params, prefix).endReason !== "running") throw new Error("The run has already ended");
  let sequences: number[][] = [[...prefix]];
  for (let depth = 0; depth < MISS_SEARCH_ROWS; depth++) {
    const next: number[][] = [];
    for (const taps of sequences) {
      const earliest = Math.max(fromMs, (taps.at(-1) ?? 0) + 1);
      const moving = simulate(params, taps, earliest).moving;
      if (!moving) continue;
      const step = stepMs(params, moving.row);
      const first = Math.max(0, Math.ceil((earliest - moving.startMs) / step));
      // Each position of a full bounce, tapped in the middle of its step.
      for (let i = first; i < first + 2 * COLUMNS; i++) {
        const tap = Math.round(moving.startMs + step * (i + 0.5));
        if (tap < earliest) continue;
        const locked = simulate(params, [...taps, tap]).rows[moving.row - 1];
        if (locked.width === 0) return [...taps, tap];
        next.push([...taps, tap]);
      }
    }
    sequences = next;
  }
  throw new Error("No deliberate miss found");
}
