import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Stacking: a block slides back and forth above the tower; each tap drops it, and the part
 * that overhangs the block below is trimmed, so the tower narrows. Score = blocks placed.
 *
 * Everything is in logical units (the renderer scales them) and driven only by elapsed
 * milliseconds since the run started, so the server can replay a run from its taps.
 */

export const FIELD_WIDTH = 400;
export const BASE_BLOCK = { left: 100, width: 200 } as const;
export const MAX_TAPS = 200;

/**
 * Per-player randomization (DESIGN.md: randomize start speed, direction and ramp). Speeds are
 * in units per ms: at 0.2 a block crosses the 200-unit gap above the base in one second.
 * The run is capped at one minute.
 */
export const PARAM_RANGES = {
  startSpeed: { min: 0.18, max: 0.24 },
  ramp: { min: 0.004, max: 0.008 },
  maxDurationMs: 60_000,
} as const;

export type Direction = "left" | "right";

export type StackingParams = {
  /** Speed of block 1, in units per ms. */
  startSpeed: number;
  /** Extra speed for each later block, in units per ms. */
  ramp: number;
  /** Where block 1 heads: "right" starts it at the left edge. Later blocks alternate. */
  direction: Direction;
  /** Taps after this many ms are ignored. */
  maxDurationMs: number;
};

export type StackingInputs = { tapsMs: number[] };

export type PlacedBlock = { left: number; width: number; overhang: number };

/** The block in the air: block `index` (1-based), released at `startMs`. */
export type MovingBlock = { index: number; width: number; startMs: number };

export type StackingResult = {
  score: number;
  /** Placed blocks from the bottom up, already trimmed. */
  blocks: PlacedBlock[];
  endedAtMs: number;
  /**
   * "miss": a block missed the tower. "time": a tap came after maxDurationMs. "inputs": the
   * taps ran out first, so the run may still be going (the client's live view).
   */
  endReason: "miss" | "time" | "inputs";
  /** The block still sliding when the taps ran out; null once the run has ended. */
  moving: MovingBlock | null;
};

// Positions are rounded to 1/1000 of a unit so floating-point noise can never turn an exact
// edge-to-edge landing into a hair of overlap (or the reverse).
const snap = (value: number) => Math.round(value * 1000) / 1000;

/** Left edge of the moving block at `elapsedMs` since the run started. */
export function blockLeftAt(params: StackingParams, block: MovingBlock, elapsedMs: number): number {
  const travel = FIELD_WIDTH - block.width;
  const speed = params.startSpeed + params.ramp * (block.index - 1);
  const distance = speed * Math.max(0, elapsedMs - block.startMs);
  // Bounce: the block goes 0 -> travel -> 0 every 2 * travel units.
  const phase = distance % (2 * travel);
  const fromStart = phase <= travel ? phase : 2 * travel - phase;
  const startsAtLeft = (params.direction === "right") === (block.index % 2 === 1);
  return snap(startsAtLeft ? fromStart : travel - fromStart);
}

export function simulate(params: StackingParams, tapsMs: readonly number[]): StackingResult {
  const blocks: PlacedBlock[] = [];
  let below: { left: number; width: number } = BASE_BLOCK;
  let moving: MovingBlock = { index: 1, width: BASE_BLOCK.width, startMs: 0 };
  const result = (endedAtMs: number, endReason: StackingResult["endReason"], still: MovingBlock | null) => ({
    score: blocks.length,
    blocks,
    endedAtMs,
    endReason,
    moving: still,
  });

  for (const tapMs of tapsMs) {
    if (tapMs > params.maxDurationMs) return result(params.maxDurationMs, "time", null);

    const landed = blockLeftAt(params, moving, tapMs);
    const left = Math.max(landed, below.left);
    const overlap = snap(Math.min(landed + moving.width, below.left + below.width) - left);
    if (overlap <= 0) return result(tapMs, "miss", null);

    const placed = { left, width: overlap, overhang: snap(moving.width - overlap) };
    blocks.push(placed);
    below = placed;
    moving = { index: moving.index + 1, width: overlap, startMs: tapMs };
  }

  return result(tapsMs.at(-1) ?? 0, "inputs", moving);
}

export function paramsFromSeed(seed: number): StackingParams {
  const rng = createRng(seed);
  const between = ({ min, max }: { min: number; max: number }) => Number((min + rng.next() * (max - min)).toFixed(4));
  return {
    startSpeed: between(PARAM_RANGES.startSpeed),
    ramp: between(PARAM_RANGES.ramp),
    direction: rng.pick(["left", "right"] as const),
    maxDurationMs: PARAM_RANGES.maxDurationMs,
  };
}

const inputsSchema: z.ZodType<StackingInputs> = z.object({
  tapsMs: z
    .array(z.number().nonnegative())
    .max(MAX_TAPS)
    .refine((taps) => taps.every((tap, i) => i === 0 || tap > taps[i - 1]), "Taps must be strictly increasing."),
});

export const stacking: ChallengeModule<StackingParams, StackingInputs> = {
  paramsFromSeed,
  score: (params, inputs) => simulate(params, inputs.tapsMs).score,
  inputsSchema,
  direction: "higher-better",
};
