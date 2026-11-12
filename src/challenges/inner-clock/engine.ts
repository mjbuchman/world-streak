import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Second Sense (Inner Clock): the player taps when they think a target time has passed since the
 * start, with a visible clock only for the first REVEAL_MS. Score = how far off the tap was, in seconds (lower is better). No
 * tap before the timeout, or a tap after it, scores as far off as a tap right at the timeout.
 *
 * The tap is timed client-side (`performance.now()` from the start), so device and screen lag
 * add a little error for everyone (design watch-out).
 */

/**
 * The target is a whole multiple of 100 ms in this range (inclusive). Raised from 3-9 s at the M3
 * play-test, to make up for the second the clock is shown.
 */
export const TARGET_RANGE_MS = { min: 5000, max: 12_000 } as const;

/**
 * The game shows a running clock for this long from the start, then hides it, so the player has
 * an exact starting point (M3 play-test). The target still counts from the start.
 */
export const REVEAL_MS = 1000;
const TARGET_STEP_MS = 100;

/** The run ends this many targets after the start. */
export const TIMEOUT_FACTOR = 3;

export type InnerClockParams = {
  /** When the player should tap, in ms from the start. */
  targetMs: number;
  /** When the run ends without a tap, in ms from the start. */
  timeoutMs: number;
};

/** The tap in ms from the start, or null when the run timed out without one. */
export type InnerClockInputs = { tapMs: number | null };

export function paramsFromSeed(seed: number): InnerClockParams {
  const rng = createRng(seed);
  const targetMs = rng.int(TARGET_RANGE_MS.min / TARGET_STEP_MS, TARGET_RANGE_MS.max / TARGET_STEP_MS) * TARGET_STEP_MS;
  return { targetMs, timeoutMs: TIMEOUT_FACTOR * targetMs };
}

/** The error in seconds, rounded to the nearest ms; a missing or late tap scores the worst error. */
export function tapScore(params: InnerClockParams, tapMs: number | null): number {
  if (tapMs === null || tapMs > params.timeoutMs) return ((TIMEOUT_FACTOR - 1) * params.targetMs) / 1000;
  return Math.round(Math.abs(tapMs - params.targetMs)) / 1000;
}

// zod 4 numbers already reject NaN and Infinity.
const inputsSchema: z.ZodType<InnerClockInputs> = z.object({ tapMs: z.number().nonnegative().nullable() });

export const innerClock: ChallengeModule<InnerClockParams, InnerClockInputs> = {
  paramsFromSeed,
  score: (params, inputs) => tapScore(params, inputs.tapMs),
  // One tap, or none once the timeout has passed: either way the run is over.
  finished: () => true,
  inputsSchema,
  direction: "lower-better",
  lastInputMs: (inputs) => inputs.tapMs ?? 0,
};
