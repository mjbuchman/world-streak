import { createRng } from "../shared/prng";
import { IDLE_LOCK_MS, MAX_TAPS, columnAt, simulate, stepMs, type StackingParams } from "./engine";

const REACTION_MS = 250;

/**
 * A simulated player for tuning and golden tests. On each row it waits (after a short reaction
 * time) for the run of cells to sit fully over the row below, aims at the middle of that step,
 * and taps with a timing error spread evenly up to `errorMs` either way. Deterministic for a
 * given `seed`.
 *
 * Test support only (tuning and golden fixtures): app code must never import this.
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
    for (let t = start + step / 2; t < moving.startMs + IDLE_LOCK_MS - step; t += step) {
      if (isAligned(columnAt(params, moving, t))) {
        aim = t;
        break;
      }
    }
    if (aim < 0) break; // cannot line up in time: let the row lock by itself
    const error = (rng.next() * 2 - 1) * errorMs;
    taps.push(Math.max(moving.startMs + 1, Math.round(aim + error)));
  }
  return taps;
}
