import { describe, expect, it } from "vitest";
import { paramsFromSeed, simulate } from "../src/challenges/stacking/engine";
import { tapsForAMiss } from "./e2e/support/tower";

// The /play e2e test gets a random seed from the server, so the helper must work for any seed.
describe("tapsForAMiss (e2e support)", () => {
  it("finds a run that ends on a tapped miss for every seed tried", () => {
    for (let seed = 0; seed < 500; seed++) {
      // Spread the seeds over the whole 32-bit range.
      const params = paramsFromSeed(Math.imul(seed, 2_654_435_761) >>> 0);
      const taps = tapsForAMiss(params);
      const result = simulate(params, taps);
      expect(result.endReason, `seed ${seed}`).toBe("miss");
      expect(result.rows.at(-1), `seed ${seed}`).toMatchObject({ width: 0, byTap: true });
      // Whole, strictly increasing ms: replayable exactly with a paused browser clock.
      taps.forEach((tap, i) => {
        expect(Number.isInteger(tap)).toBe(true);
        if (i > 0) expect(tap).toBeGreaterThan(taps[i - 1]);
      });
    }
  });
});
