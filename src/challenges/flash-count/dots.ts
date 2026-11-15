import type { Rng } from "../shared/prng";

/**
 * Swift Sum's dot layouts. Positions are in a unit square (the renderer scales them), in whole
 * thousandths so they are exact in JSON and the spacing checks hold for the stored numbers.
 */

/** Each dot's radius, in the unit square (inclusive), so dot size gives away nothing. */
export const DOT_RADIUS_RANGE = { min: 0.018, max: 0.028 } as const;
/** Least distance between two dots' centres: more than two of the largest radii, so none touch. */
export const MIN_SPACING = 0.08;
/** Random tries per dot before the layout falls back to the grid. */
const MAX_TRIES_PER_DOT = 200;

export type Dot = { x: number; y: number; r: number };

const THOUSANDTHS = 1000;
const far = (dot: Dot, others: Dot[]) => others.every((other) => Math.hypot(dot.x - other.x, dot.y - other.y) >= MIN_SPACING);

/**
 * A fixed grid of `count` dots, row by row, each at the smallest radius: valid for up to 49 dots
 * (a 7 x 7 grid's spacing is 0.142), and the same for every seed.
 */
function gridDots(count: number): Dot[] {
  const side = Math.ceil(Math.sqrt(count));
  const centre = (i: number) => Math.round(((i + 0.5) / side) * THOUSANDTHS) / THOUSANDTHS;
  return Array.from({ length: count }, (_, i) => ({ x: centre(i % side), y: centre(Math.floor(i / side)), r: DOT_RADIUS_RANGE.min }));
}

/**
 * `count` dots placed at random, each kept inside the square and MIN_SPACING from the others.
 * Each dot gets `triesPerDot` random tries; if one runs out, the whole layout is the grid, so
 * this always ends, with a valid layout, for every seed.
 */
export function placeDots(rng: Rng, count: number, triesPerDot = MAX_TRIES_PER_DOT): Dot[] {
  const dots: Dot[] = [];
  const rMin = Math.round(DOT_RADIUS_RANGE.min * THOUSANDTHS);
  const rMax = Math.round(DOT_RADIUS_RANGE.max * THOUSANDTHS);
  while (dots.length < count) {
    let placed = false;
    for (let tries = 0; tries < triesPerDot && !placed; tries++) {
      const r = rng.int(rMin, rMax);
      const dot = { x: rng.int(r, THOUSANDTHS - r) / THOUSANDTHS, y: rng.int(r, THOUSANDTHS - r) / THOUSANDTHS, r: r / THOUSANDTHS };
      if (far(dot, dots)) {
        dots.push(dot);
        placed = true;
      }
    }
    if (!placed) return gridDots(count);
  }
  return dots;
}
