import { createRng } from "../shared/prng";
import { BASE_BLOCK, MAX_TAPS, blockLeftAt, simulate, type StackingParams } from "./engine";

/**
 * A simulated player for tuning and golden tests: after a short reaction delay it waits for
 * the block to line up with the one below, then taps with a random timing error of up to
 * `errorMs` either way. Deterministic for a given `seed`.
 */
export function simulatedTaps(params: StackingParams, errorMs: number, seed: number): number[] {
  const rng = createRng(seed);
  const taps: number[] = [];
  const reactionMs = 300;
  const patienceMs = 10_000;
  while (taps.length < MAX_TAPS) {
    const { moving, blocks } = simulate(params, taps);
    if (!moving) break;
    const below = blocks.at(-1) ?? BASE_BLOCK;
    let t = moving.startMs + reactionMs;
    while (Math.abs(blockLeftAt(params, moving, t) - below.left) > 2 && t < moving.startMs + patienceMs) t++;
    const error = Math.round((rng.next() * 2 - 1) * errorMs);
    taps.push(Math.max(moving.startMs + 1, t + error));
    if (taps.at(-1)! > params.maxDurationMs) break;
  }
  return taps;
}
