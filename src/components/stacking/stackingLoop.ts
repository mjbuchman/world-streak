import { simulate, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";

export type Frame = { result: StackingResult; finished: boolean };

/**
 * The game state at `elapsedMs`, given every tap so far. Taps carry the time of their input
 * event, not of the frame that read them, so the result never depends on the frame rate.
 *
 * The engine only reports "time" when a tap arrives late, so a player who stops tapping is
 * ended here once the time limit passes.
 */
export function frameAt(params: StackingParams, taps: readonly number[], elapsedMs: number): Frame {
  const result = simulate(params, taps);
  if (result.endReason !== "inputs") return { result, finished: true };
  if (elapsedMs < params.maxDurationMs) return { result, finished: false };
  return {
    result: { ...result, endReason: "time", endedAtMs: params.maxDurationMs, moving: null },
    finished: true,
  };
}
