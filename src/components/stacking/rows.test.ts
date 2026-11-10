import { describe, expect, it } from "vitest";
import { reachedRow, targetRow, targetRowNumber } from "./rows";

// The result speaks in rows, like the HUD ("Row 10 to pass"): human decision, second play-test.
describe("reachedRow", () => {
  it("names the row the player reached", () => {
    expect(reachedRow(7)).toBe("You reached row 7");
    expect(reachedRow(1)).toBe("You reached row 1");
    expect(reachedRow(15)).toBe("You reached row 15");
  });

  it("has words for no rows (only attempts stored before T87 can score 0)", () => {
    expect(reachedRow(0)).toBe("You didn't stack a row");
  });
});

describe("targetRow", () => {
  it("names the target row, rounding a fractional target up as the HUD does", () => {
    expect(targetRow(10)).toBe("row 10");
    expect(targetRow(10.2)).toBe("row 11");
    expect([10, 10.2, 10.9].map(targetRowNumber)).toEqual([10, 11, 11]);
  });
});
