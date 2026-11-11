import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import {
  DOT_COUNT_RANGE,
  DOT_RADIUS_RANGE,
  FLASH_MS,
  MIN_SPACING,
  countScore,
  flashCount,
  paramsFromSeed,
  placeDots,
  type Dot,
} from "./engine";

const distance = (a: Dot, b: Dot) => Math.hypot(a.x - b.x, a.y - b.y);

/** Every pair at least MIN_SPACING apart (centre to centre), and every dot fully inside the square. */
function expectValidLayout(dots: Dot[]) {
  const clipped = dots.filter(
    (d) => d.x - d.r < 0 || d.y - d.r < 0 || d.x + d.r > 1 || d.y + d.r > 1 || d.r < DOT_RADIUS_RANGE.min || d.r > DOT_RADIUS_RANGE.max,
  );
  expect(clipped).toEqual([]);
  let closest = Infinity;
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) closest = Math.min(closest, distance(dots[i], dots[j]));
  }
  expect(closest).toBeGreaterThanOrEqual(MIN_SPACING);
}

describe("Flash Count params", () => {
  it("documents its ranges: 15 to 45 dots, flashed for 1 s, spaced so none touch", () => {
    expect(DOT_COUNT_RANGE).toEqual({ min: 15, max: 45 });
    expect(FLASH_MS).toBe(1000);
    // The widest two dots still leave a gap between them.
    expect(MIN_SPACING).toBeGreaterThan(2 * DOT_RADIUS_RANGE.max);
  });

  it("has as many dots as its count, inside the range, validly laid out, for seeds 0 to 999", () => {
    const counts = new Set<number>();
    for (let seed = 0; seed < 1000; seed++) {
      const params = paramsFromSeed(seed);
      expect(params.flashMs).toBe(1000);
      expect(params.dots).toHaveLength(params.dotCount);
      expect(params.dotCount).toBeGreaterThanOrEqual(DOT_COUNT_RANGE.min);
      expect(params.dotCount).toBeLessThanOrEqual(DOT_COUNT_RANGE.max);
      expectValidLayout(params.dots);
      counts.add(params.dotCount);
    }
    // Every count from 15 to 45 occurs, the maximum included.
    expect(counts.size).toBe(31);
  });

  it("gives identical dots for the same seed and different layouts for different seeds", () => {
    expect(paramsFromSeed(42)).toEqual(paramsFromSeed(42));
    const layouts = new Set(Array.from({ length: 50 }, (_, seed) => JSON.stringify(paramsFromSeed(seed).dots)));
    expect(layouts.size).toBe(50);
  });

  it.each([
    [0, 23, { x: 0.233, y: 0.159, r: 0.018 }],
    [1, 34, { x: 0.526, y: 0.964, r: 0.018 }],
    [4_294_967_295, 42, { x: 0.707, y: 0.927, r: 0.02 }],
  ])("golden: seed %i has %i dots, the first at %o (changing the PRNG or the layout changes these)", (seed, dotCount, first) => {
    const params = paramsFromSeed(seed);
    expect(params.dotCount).toBe(dotCount);
    expect(params.dots[0]).toEqual(first);
  });
});

describe("placeDots", () => {
  it("lays out the maximum count validly", () => {
    for (let seed = 0; seed < 200; seed++) expectValidLayout(placeDots(createRng(seed), DOT_COUNT_RANGE.max));
  });

  it("falls back to a fixed grid when random tries run out, so it always ends with a valid layout", () => {
    // One try per dot cannot place 45 dots at random; the grid can.
    const dots = placeDots(createRng(7), DOT_COUNT_RANGE.max, 1);
    expect(dots).toHaveLength(DOT_COUNT_RANGE.max);
    expectValidLayout(dots);
    expect(placeDots(createRng(8), DOT_COUNT_RANGE.max, 1)).toEqual(placeDots(createRng(9), DOT_COUNT_RANGE.max, 1));
  });
});

describe("Flash Count score", () => {
  const at = (dotCount: number) => ({ ...paramsFromSeed(0), dotCount });

  it.each([
    [22, 12],
    [25, 0],
    [30, 20],
    [0, 100],
  ])("with 25 dots, a count of %i scores %d", (count, score) => {
    expect(flashCount.score(at(25), { count })).toBe(score);
  });

  it("rounds the error percentage to 2 decimals", () => {
    expect(countScore(at(33), 30)).toBe(9.09);
    expect(countScore(at(45), 44)).toBe(2.22);
    expect(countScore(at(15), 999)).toBe(6560);
  });

  it("is lower-better, always finished, and has no timed input", () => {
    expect(flashCount.direction).toBe("lower-better");
    expect(flashCount.finished(at(25), { count: 3 })).toBe(true);
    expect(flashCount.lastInputMs({ count: 3 })).toBe(0);
  });
});

describe("Flash Count inputs", () => {
  it.each([0, 25, 999])("accepts a whole count of %i", (count) => {
    expect(flashCount.inputsSchema.safeParse({ count }).success).toBe(true);
  });

  it.each([
    ["a negative count", { count: -1 }],
    ["a count over 999", { count: 1000 }],
    ["a fraction", { count: 2.5 }],
    ["NaN", { count: NaN }],
    ["a text count", { count: "25" }],
    ["no count", {}],
  ])("rejects %s", (_name, inputs) => {
    expect(flashCount.inputsSchema.safeParse(inputs).success).toBe(false);
  });
});
