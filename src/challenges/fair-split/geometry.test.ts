import { describe, expect, it } from "vitest";
import { clipLeft, polygonArea, splitShare, type Point } from "./geometry";

const p = (x: number, y: number): Point => ({ x, y });
const square = [p(0, 0), p(100, 0), p(100, 100), p(0, 100)];
/** An L: the square's left half plus its bottom-right quarter (area 7500). */
const ell = [p(0, 0), p(50, 0), p(50, 50), p(100, 50), p(100, 100), p(0, 100)];

describe("polygonArea", () => {
  it("is the shoelace area, whichever way round", () => {
    expect(polygonArea(square)).toBe(10_000);
    expect(polygonArea([...square].reverse())).toBe(10_000);
    expect(polygonArea(ell)).toBe(7500);
    expect(polygonArea([])).toBe(0);
  });
});

describe("splitShare", () => {
  it("halves the square at x = 50 and gives 0.49 or 0.51 at x = 51, by side", () => {
    expect(splitShare(square, p(50, 0), p(50, 100))).toBeCloseTo(0.5, 12);
    expect(splitShare(square, p(51, 0), p(51, 100))).toBeCloseTo(0.51, 12);
    expect(splitShare(square, p(51, 100), p(51, 0))).toBeCloseTo(0.49, 12);
  });

  it("measures the total area on one side of a cut through a concave shape (two pieces)", () => {
    // y = 75 cuts off a bottom bar (100 x 25); x = 75 cuts off 25 x 50 of the foot.
    expect(splitShare(ell, p(0, 75), p(100, 75))).toBeCloseTo(2500 / 7500, 12);
    expect(splitShare(ell, p(75, 100), p(75, 0))).toBeCloseTo(1250 / 7500, 12);
    // y = x - 40 crosses the notch: two corner triangles of 50 each lie below it, the rest above.
    expect(splitShare(ell, p(40, 0), p(100, 60))).toBeCloseTo(7400 / 7500, 12);
  });

  it("is 0 or 1 for a line that misses the shape, and 0 for a cut with no length", () => {
    const shares = [splitShare(square, p(120, 0), p(120, 100)), splitShare(square, p(120, 100), p(120, 0))].sort();
    expect(shares).toEqual([0, 1]);
    expect(splitShare(square, p(50, 50), p(50, 50))).toBe(0);
  });

  it("clipLeft keeps the piece on the left of the line", () => {
    expect(polygonArea(clipLeft(square, p(51, 0), p(51, 100)))).toBeCloseTo(5100, 9);
  });
});
