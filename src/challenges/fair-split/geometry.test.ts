import { describe, expect, it } from "vitest";
import { clipLeft, polygonArea, shapeFor, splitShare, type Point } from "./geometry";

const p = (x: number, y: number): Point => ({ x, y });
const square = [p(0, 0), p(100, 0), p(100, 100), p(0, 100)];
/** An L: the square's left half plus its bottom-right quarter (area 7500). */
const ell = [p(0, 0), p(50, 0), p(50, 50), p(100, 50), p(100, 100), p(0, 100)];

/** Whether two segments cross or touch (shared endpoints of neighbouring edges are skipped by the caller). */
function segmentsMeet(a: Point, b: Point, c: Point, d: Point): boolean {
  const cross = (o: Point, s: Point, t: Point) => (s.x - o.x) * (t.y - o.y) - (s.y - o.y) * (t.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

function isSimple(polygon: readonly Point[]): boolean {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsMeet(polygon[i], polygon[(i + 1) % n], polygon[j], polygon[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** Whether some vertex turns the other way from the polygon's winding (a dent). */
function isConcave(polygon: readonly Point[]): boolean {
  const n = polygon.length;
  const turns = polygon.map((b, i) => {
    const a = polygon[(i + n - 1) % n];
    const c = polygon[(i + 1) % n];
    return Math.sign((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  });
  return turns.some((t) => t !== turns[0]);
}

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

describe("shapeFor", () => {
  it("is simple, at least 30% of the box, inside it and the same every time, for seeds 0 to 999", () => {
    for (let seed = 0; seed < 1000; seed++) {
      for (const oddness of [0, 0.5, 1]) {
        const shape = shapeFor(seed, seed % 12, oddness);
        expect(isSimple(shape)).toBe(true);
        expect(polygonArea(shape)).toBeGreaterThanOrEqual(3000);
        expect(shape.every(({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 100)).toBe(true);
        expect(shapeFor(seed, seed % 12, oddness)).toEqual(shape);
      }
    }
  });

  it("is convex at oddness 0 and concave at oddness 1", () => {
    for (let seed = 0; seed < 1000; seed++) {
      expect(isConcave(shapeFor(seed, 0, 0))).toBe(false);
      expect(isConcave(shapeFor(seed, 0, 1))).toBe(true);
    }
  });

  it("differs by index and seed", () => {
    expect(shapeFor(1, 0, 1)).not.toEqual(shapeFor(1, 1, 1));
    expect(shapeFor(1, 0, 1)).not.toEqual(shapeFor(2, 0, 1));
  });
});
