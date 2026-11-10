import { describe, expect, it } from "vitest";
import { simulate, type StackingParams } from "@/challenges/stacking/engine";
import { tapsForAMiss } from "@/challenges/stacking/player";
import { frameAt, type Frame } from "./stackingLoop";

const params: StackingParams = { startStepMs: 160, stepDecayMs: 7, startColumn: 2, direction: "right" };

describe("frameAt", () => {
  it("keeps the run going while it waits for the next tap", () => {
    const frame = frameAt(params, [900], 1500);
    expect(frame.finished).toBe(false);
    expect(frame.result).toEqual(simulate(params, [900], 1500));
    expect(frame.result.moving).toMatchObject({ row: 2 });
  });

  it("finishes on a miss, with the engine's result", () => {
    // Row 1 locks at 2-4 straight away; row 2 appears at the right wall (4-6) moving left and
    // one step later sits at 3-5: it keeps 3-4. Row 3 tapped as it appears at the left wall
    // (0-1) misses.
    const taps = [1, 170, 171];
    const frame = frameAt(params, taps, 200);
    expect(frame).toEqual({ finished: true, result: simulate(params, taps) });
    expect(frame.result.endReason).toBe("miss");
  });

  it("keeps waiting for a slow player: no time limit (T87)", () => {
    const anHourLater = frameAt(params, [900], 900 + 3_600_000);
    expect(anHourLater.finished).toBe(false);
    expect(anHourLater.result).toMatchObject({ score: 1, endReason: "running", moving: { row: 2 } });
  });
});

/**
 * Drives the loop the way StackingGame does: taps are stamped with the time of the input
 * event, and each animation frame (every `intervalMs`) reads every tap so far.
 */
function playAtFrameRate(intervalMs: number, tapTimes: number[]): { frame: Frame; frames: number } {
  const taps: number[] = [];
  let pending = [...tapTimes];
  for (let frames = 1; ; frames++) {
    const now = frames * intervalMs;
    taps.push(...pending.filter((tap) => tap <= now));
    pending = pending.filter((tap) => tap > now);
    const frame = frameAt(params, taps, now);
    if (frame.finished) return { frame, frames };
  }
}

describe("frame-rate independence", () => {
  // Seven taps, finished with a deliberate miss if they have not ended the run already.
  const seven = [930, 1712, 2577, 3401, 4290, 5133, 6020];
  const tapTimes = simulate(params, seven).endReason === "running" ? tapsForAMiss(params, seven, 6021) : seven;

  it("gives identical results at 60 and 120 frames per second", () => {
    const at60 = playAtFrameRate(16.7, tapTimes);
    const at120 = playAtFrameRate(8.3, tapTimes);
    expect(at120.frames).toBeGreaterThan(at60.frames * 1.9);
    expect(at120.frame.result).toEqual(at60.frame.result);
    expect(at60.frame.result).toEqual(simulate(params, tapTimes));
  });

  it("gives identical results for a run that ends on a deliberate miss", () => {
    const taps = tapsForAMiss(params);
    const at60 = playAtFrameRate(16.7, taps);
    const at120 = playAtFrameRate(8.3, taps);
    expect(at60.frame.result.endReason).toBe("miss");
    expect(at120.frame.result).toEqual(at60.frame.result);
  });
});
