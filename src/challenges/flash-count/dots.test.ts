import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { DOT_RADIUS_RANGE, MIN_SPACING, placeDots, type Dot } from "./dots";
import { DOT_COUNT_MAX, DOT_COUNT_MIN } from "./engine";

const distance = (a: Dot, b: Dot) => Math.hypot(a.x - b.x, a.y - b.y);
/** Swift Sum's largest count. */
const MOST = DOT_COUNT_MAX;

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

describe("placeDots", () => {
  it("spaces dots so none touch", () => {
    // The widest two dots still leave a gap between them.
    expect(MIN_SPACING).toBeGreaterThan(2 * DOT_RADIUS_RANGE.max);
  });

  it("lays out the largest count validly, the same for the same seed", () => {
    for (let seed = 0; seed < 100; seed++) {
      const dots = placeDots(createRng(seed), MOST);
      expect(dots).toHaveLength(MOST);
      expectValidLayout(dots);
      expect(placeDots(createRng(seed), MOST)).toEqual(dots);
    }
  });

  it("lays out every count from 10 to 30 validly over several seeds (T205)", () => {
    for (let count = DOT_COUNT_MIN; count <= DOT_COUNT_MAX; count++) {
      for (let seed = 0; seed < 10; seed++) {
        const dots = placeDots(createRng(seed), count);
        expect(dots).toHaveLength(count);
        expectValidLayout(dots);
      }
    }
  });

  it("gives different layouts for different seeds", () => {
    const layouts = new Set(Array.from({ length: 50 }, (_, seed) => JSON.stringify(placeDots(createRng(seed), 12))));
    expect(layouts.size).toBe(50);
  });

  it("falls back to a fixed grid when random tries run out, so it always ends with a valid layout", () => {
    // One try per dot cannot place this many dots at random; the grid can.
    const dots = placeDots(createRng(7), MOST, 1);
    expect(dots).toHaveLength(MOST);
    expectValidLayout(dots);
    expect(placeDots(createRng(8), MOST, 1)).toEqual(placeDots(createRng(9), MOST, 1));
  });
});
