import { describe, expect, it } from "vitest";
import { simulate, type StackingParams } from "@/challenges/stacking/engine";
import { frameAt, type Frame } from "./stackingLoop";

const params: StackingParams = { startSpeed: 0.11, ramp: 0.0025, direction: "right", maxDurationMs: 60_000 };

describe("frameAt", () => {
  it("keeps the run going while the taps are still landing and time is left", () => {
    const frame = frameAt(params, [900], 1500);
    expect(frame.finished).toBe(false);
    expect(frame.result).toEqual(simulate(params, [900]));
  });

  it("finishes on a miss, with the engine's result", () => {
    const steady = { ...params, startSpeed: 0.2, ramp: 0 };
    // From the T09 worked example: block 2 lands edge to edge at 2000 ms and misses.
    const frame = frameAt(steady, [750, 2000], 2010);
    expect(frame).toEqual({ finished: true, result: simulate(steady, [750, 2000]) });
    expect(frame.result.endReason).toBe("miss");
  });

  it("ends the run at the time limit even when the player stops tapping", () => {
    const frame = frameAt(params, [900], 60_000);
    expect(frame.finished).toBe(true);
    expect(frame.result).toEqual({
      ...simulate(params, [900]),
      endReason: "time",
      endedAtMs: 60_000,
      moving: null,
    });
  });

  it("does not end one frame early", () => {
    expect(frameAt(params, [], 59_999.9).finished).toBe(false);
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
  const tapTimes = [930, 1712, 2577, 3401, 4290, 5133, 6020];

  it("gives identical results at 60 and 120 frames per second", () => {
    const at60 = playAtFrameRate(16.7, tapTimes);
    const at120 = playAtFrameRate(8.3, tapTimes);
    expect(at120.frames).toBeGreaterThan(at60.frames * 1.9);
    expect(at120.frame.result).toEqual(at60.frame.result);
    expect(at60.frame.result).toMatchObject({ score: simulate(params, tapTimes).score, endReason: "time" });
  });

  it("gives identical results when the run ends in a miss", () => {
    const missing = [...tapTimes, 6030];
    const at60 = playAtFrameRate(16.7, missing);
    const at120 = playAtFrameRate(8.3, missing);
    expect(at60.frame.result.endReason).toBe("miss");
    expect(at120.frame.result).toEqual(at60.frame.result);
  });
});
