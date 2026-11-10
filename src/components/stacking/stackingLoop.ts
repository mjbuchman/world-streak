import { simulate, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";

export type Frame = { result: StackingResult; finished: boolean };

/**
 * The game state at `elapsedMs`, given every tap so far. Taps carry the time of their input
 * event, not of the frame that read them, so the result never depends on the frame rate.
 */
export function frameAt(params: StackingParams, taps: readonly number[], elapsedMs: number): Frame {
  const result = simulate(params, taps, elapsedMs);
  return { result, finished: result.endReason !== "running" };
}
