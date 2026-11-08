import { describe, expect, it } from "vitest";
import { PARAM_RANGES, simulate, type StackingParams } from "./engine";
import { simulatedTaps } from "./player";

// DESIGN.md: "Speed rises with height to cap runs near one minute." These pin the tuning so a
// change to the ranges is a deliberate decision (record it in docs/DECISIONS.md).
const corners: StackingParams[] = [
  { startSpeed: PARAM_RANGES.startSpeed.min, ramp: PARAM_RANGES.ramp.min },
  { startSpeed: PARAM_RANGES.startSpeed.max, ramp: PARAM_RANGES.ramp.max },
].map((speeds) => ({ ...speeds, direction: "right", maxDurationMs: PARAM_RANGES.maxDurationMs }));

function medianRunSeconds(params: StackingParams, errorMs: number): number {
  const ends = Array.from({ length: 25 }, (_, seed) => simulate(params, simulatedTaps(params, errorMs, seed)).endedAtMs);
  return ends.sort((a, b) => a - b)[12] / 1000;
}

describe("stacking difficulty", () => {
  it.each(corners)("a competent player (±30 ms) lasts about 40-60 s at %o", (params) => {
    const seconds = medianRunSeconds(params, 30);
    expect(seconds).toBeGreaterThanOrEqual(35);
    expect(seconds).toBeLessThanOrEqual(60);
  }, 30_000);

  it.each(corners)("a sloppy player (±80 ms) ends well before the minute at %o", (params) => {
    expect(medianRunSeconds(params, 80)).toBeLessThan(45);
  }, 30_000);
});
