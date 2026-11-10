import { describe, expect, it } from "vitest";
import { ROWS, paramsFromSeed, simulate } from "./engine";
import { simulatedTaps } from "./player";

// Human requirement (M1 play-test, DECISIONS): a decent player reaches about row 10. The
// simulated player taps with a timing error spread evenly up to the given amount either way:
// perfect 0 ms, decent ±80 ms, careless ±250 ms. These pin the tuning, so a change to the speed
// ranges is a deliberate decision (record it in docs/DECISIONS.md). Since T87 there is no idle
// drop: a simulated player who cannot line a row up within two bounces stops, and the rows it
// locked are its score.
function averageScore(errorMs: number): number {
  let total = 0;
  for (let seed = 0; seed < 200; seed++) {
    const params = paramsFromSeed(seed);
    total += simulate(params, simulatedTaps(params, errorMs, seed + 1000)).score;
  }
  return total / 200;
}

describe("Teetering Tower difficulty", () => {
  it("a perfect player reaches the top every time", () => {
    expect(averageScore(0)).toBe(ROWS);
  });

  it("a decent player (±80 ms) reaches about row 10", () => {
    const average = averageScore(80);
    expect(average).toBeGreaterThanOrEqual(9);
    expect(average).toBeLessThanOrEqual(11);
  });

  it("a careless player (±250 ms) gets about 4 rows", () => {
    const average = averageScore(250);
    expect(average).toBeGreaterThanOrEqual(3);
    expect(average).toBeLessThanOrEqual(5);
  });
});
