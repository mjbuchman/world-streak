import { z } from "zod";
import { createRng, type Rng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Swift Sum (Flash Count): dots flash for FLASH_MS; the player enters how many there were.
 * Score = the error as a percentage of the true count (lower is better).
 *
 * Positions are in a unit square (the renderer scales them), in whole thousandths so they are
 * exact in JSON and the spacing checks hold for the stored numbers.
 */

/**
 * How many dots an instance has (inclusive). With FLASH_MS, set after the M3 play-test (was 15-45
 * in 1 s, which felt like a guess): too many to count one by one in time, few enough to estimate.
 */
export const DOT_COUNT_RANGE = { min: 12, max: 30 } as const;
/** Each dot's radius, in the unit square (inclusive), so dot size gives away nothing. */
export const DOT_RADIUS_RANGE = { min: 0.018, max: 0.028 } as const;
/** Least distance between two dots' centres: more than two of the largest radii, so none touch. */
export const MIN_SPACING = 0.08;
/** How long the dots are shown. */
export const FLASH_MS = 1500;
/** Random tries per dot before the layout falls back to the grid. */
const MAX_TRIES_PER_DOT = 200;

export type Dot = { x: number; y: number; r: number };

export type FlashCountParams = { dotCount: number; flashMs: number; dots: Dot[] };

export type FlashCountInputs = { count: number };

const THOUSANDTHS = 1000;
const far = (dot: Dot, others: Dot[]) => others.every((other) => Math.hypot(dot.x - other.x, dot.y - other.y) >= MIN_SPACING);

/**
 * A fixed grid of `count` dots, row by row, each at the smallest radius: valid for any count in
 * range (a 7 x 7 grid's spacing is 0.142), and the same for every seed.
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

export function paramsFromSeed(seed: number): FlashCountParams {
  const rng = createRng(seed);
  const dotCount = rng.int(DOT_COUNT_RANGE.min, DOT_COUNT_RANGE.max);
  return { dotCount, flashMs: FLASH_MS, dots: placeDots(rng, dotCount) };
}

/** The error as a percentage of the true count, rounded to 2 decimals. */
export function countScore(params: FlashCountParams, count: number): number {
  return Math.round((Math.abs(count - params.dotCount) / params.dotCount) * 100 * 100) / 100;
}

const inputsSchema: z.ZodType<FlashCountInputs> = z.object({ count: z.number().int().min(0).max(999) });

export const flashCount: ChallengeModule<FlashCountParams, FlashCountInputs> = {
  paramsFromSeed,
  score: (params, inputs) => countScore(params, inputs.count),
  // One answer ends the run.
  finished: () => true,
  inputsSchema,
  direction: "lower-better",
  // The answer is typed after the flash, untimed; nothing to check against the clock.
  lastInputMs: () => 0,
};
