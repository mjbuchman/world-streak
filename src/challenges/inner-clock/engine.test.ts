import { describe, expect, it } from "vitest";
import { REVEAL_MS, TARGET_RANGE_MS, TIMEOUT_FACTOR, innerClock, paramsFromSeed, tapScore, type InnerClockParams } from "./engine";

const at = (targetMs: number): InnerClockParams => ({ targetMs, timeoutMs: TIMEOUT_FACTOR * targetMs });

describe("Inner Clock params", () => {
  it("are a target on a 100 ms step inside the documented range, with a 3x timeout, for seeds 0 to 999", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const { targetMs, timeoutMs } = paramsFromSeed(seed);
      expect(targetMs % 100).toBe(0);
      expect(targetMs).toBeGreaterThanOrEqual(TARGET_RANGE_MS.min);
      expect(targetMs).toBeLessThanOrEqual(TARGET_RANGE_MS.max);
      expect(timeoutMs).toBe(3 * targetMs);
    }
  });

  it("documents the default range: 7,000 to 13,000 ms, with the clock shown for the first second", () => {
    expect(TARGET_RANGE_MS).toEqual({ min: 7000, max: 13_000 });
    expect(REVEAL_MS).toBe(1000);
    // The shown second never gives the answer away.
    expect(REVEAL_MS).toBeLessThan(TARGET_RANGE_MS.min);
  });

  it("are the same for the same seed and spread across the range", () => {
    const targets = new Set<number>();
    for (let seed = 0; seed < 1000; seed++) {
      expect(paramsFromSeed(seed)).toEqual(paramsFromSeed(seed));
      targets.add(paramsFromSeed(seed).targetMs);
    }
    // 61 possible targets; a thousand seeds reach every one, both ends included.
    expect(targets.size).toBe(61);
  });

  it.each([
    [0, 8600],
    [1, 10_800],
    [4_294_967_295, 12_400],
  ])("golden: seed %i gives a target of %i ms (changing the PRNG or the range changes these)", (seed, targetMs) => {
    expect(paramsFromSeed(seed)).toEqual(at(targetMs));
  });
});

describe("Inner Clock score", () => {
  it.each([
    [5320, 0.32],
    [4700, 0.3],
    [5000, 0],
    [null, 10],
  ])("target 5,000 with a tap at %s scores %d", (tapMs, score) => {
    expect(innerClock.score(at(5000), { tapMs })).toBe(score);
  });

  it("rounds the error to the nearest millisecond", () => {
    expect(tapScore(at(5000), 5320.4)).toBe(0.32);
    expect(tapScore(at(5000), 5320.6)).toBe(0.321);
    expect(tapScore(at(5000), 4999.5)).toBe(0.001);
  });

  it("scores a tap after the timeout like no tap at all; a tap right at the timeout still counts", () => {
    expect(tapScore(at(5000), 15_000)).toBe(10);
    expect(tapScore(at(5000), 15_000.5)).toBe(10);
    expect(tapScore(at(3000), 9001)).toBe(6);
    expect(tapScore(at(3000), 8999)).toBe(5.999);
  });

  it("is lower-better, so a smaller error is the better score", () => {
    expect(innerClock.direction).toBe("lower-better");
  });

  it("gives the same score for the same instance and tap, whatever the seed (property)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const params = paramsFromSeed(seed);
      const tapMs = (seed * 37) % (params.timeoutMs + 1000);
      const first = innerClock.score(params, { tapMs });
      expect(innerClock.score(params, { tapMs })).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual((2 * params.targetMs) / 1000);
    }
  });
});

describe("Inner Clock inputs", () => {
  it("accepts a tap in ms from the start, or no tap", () => {
    expect(innerClock.inputsSchema.safeParse({ tapMs: 5320.25 }).success).toBe(true);
    expect(innerClock.inputsSchema.safeParse({ tapMs: 0 }).success).toBe(true);
    expect(innerClock.inputsSchema.safeParse({ tapMs: null }).success).toBe(true);
  });

  it.each([
    ["a negative tap", { tapMs: -1 }],
    ["an infinite tap", { tapMs: Infinity }],
    ["NaN", { tapMs: NaN }],
    ["a text tap", { tapMs: "5000" }],
    ["no tap field", {}],
    ["several taps", { tapMs: [5000] }],
  ])("rejects %s", (_name, inputs) => {
    expect(innerClock.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("is always a finished run: the game submits one tap, or none once the timeout has passed", () => {
    expect(innerClock.finished(at(5000), { tapMs: 1 })).toBe(true);
    expect(innerClock.finished(at(5000), { tapMs: null })).toBe(true);
  });

  it("times its latest input at the tap, or 0 with none", () => {
    expect(innerClock.lastInputMs({ tapMs: 5320 })).toBe(5320);
    expect(innerClock.lastInputMs({ tapMs: null })).toBe(0);
  });
});
