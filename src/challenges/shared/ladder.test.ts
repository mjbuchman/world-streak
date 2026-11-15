import { describe, expect, it } from "vitest";
import { ladderRanges } from "./ladder";

describe("ladderRanges", () => {
  it("steps each round's range up from the start, each as wide as asked", () => {
    expect(ladderRanges(3, 8, 3, 2)).toEqual([
      { min: 8, max: 10 },
      { min: 11, max: 13 },
      { min: 14, max: 16 },
    ]);
  });

  it("gives no rounds for zero, and one range for one", () => {
    expect(ladderRanges(0, 5, 1, 1)).toEqual([]);
    expect(ladderRanges(1, 3000, 1000, 500)).toEqual([{ min: 3000, max: 3500 }]);
  });
});
