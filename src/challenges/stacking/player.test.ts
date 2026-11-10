import { describe, expect, it } from "vitest";
import { paramsFromSeed, simulate } from "./engine";
import { simulatedTaps, tapsForAMiss } from "./player";

// Spread the seeds over the whole 32-bit range.
const seedAt = (i: number) => Math.imul(i, 2_654_435_761) >>> 0;

// Component and e2e tests end runs with this (the /play e2e test gets a random seed from the
// server), so it must work for any seed and from any point in a run.
describe("tapsForAMiss", () => {
  it("finds a run that ends on a tapped miss for every seed tried", () => {
    for (let i = 0; i < 500; i++) {
      const params = paramsFromSeed(seedAt(i));
      const taps = tapsForAMiss(params);
      const result = simulate(params, taps);
      expect(result.endReason, `seed ${seedAt(i)}`).toBe("miss");
      expect(result.rows.at(-1)!.width).toBe(0);
      // Whole, strictly increasing ms: replayable exactly with a paused browser clock.
      taps.forEach((tap, j) => {
        expect(Number.isInteger(tap)).toBe(true);
        if (j > 0) expect(tap).toBeGreaterThan(taps[j - 1]);
      });
    }
  });

  it("continues from taps already made, never tapping before the given time", () => {
    for (let i = 0; i < 100; i++) {
      const params = paramsFromSeed(seedAt(i));
      // Two perfect rows: a run still going, with a full-width tower to get past.
      const prefix = simulatedTaps(params, 0, 1).slice(0, 2);
      const fromMs = prefix[1] + 700;
      const taps = tapsForAMiss(params, prefix, fromMs);
      expect(taps.slice(0, 2)).toEqual(prefix);
      expect(taps.slice(2).every((tap) => tap >= fromMs)).toBe(true);
      expect(simulate(params, taps).endReason).toBe("miss");
    }
  });

  it("refuses to continue a run that has already ended", () => {
    const params = paramsFromSeed(1);
    const ended = tapsForAMiss(params);
    expect(() => tapsForAMiss(params, ended)).toThrow(/already ended/);
  });
});
