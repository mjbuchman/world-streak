import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";
import { placeDots, type Dot } from "./engine";

/**
 * Swift Sum: Flash Ladder. Levels of the Swift Sum flash (dots flash, say how many), each with
 * more dots and a shorter flash. A count within the tolerance clears the level; a wrong one costs
 * one of LIVES lives and retries the same level with a new layout (DECISIONS, T141). Score =
 * levels cleared + lives left as a fraction, when the run ends. All numbers below are
 * placeholders tuned at the M5 play-test.
 */

export const LIVES = 3;
export const MAX_ROUNDS = 10;
/** A count is right within this share of the true count (and always within 1). */
export const TOLERANCE_FRACTION = 0.1;

/** Level i's dot count range: three more dots a level, so the counts always rise. */
export const DOT_COUNT_RANGES: readonly { min: number; max: number }[] = Array.from({ length: MAX_ROUNDS }, (_, i) => ({
  min: 8 + 3 * i,
  max: 10 + 3 * i,
}));

/** The flash shortens by FLASH_STEP_MS a level, from the max down to the min. */
const FLASH_STEP_MS = 120;
export const FLASH_MS_RANGE = { min: 1800 - FLASH_STEP_MS * (MAX_ROUNDS - 1), max: 1800 } as const;

export type FlashLadderLevel = { dotCount: number; flashMs: number };

/** The levels, and the seed every layout is built from (a layout is drawn when it is shown). */
export type FlashLadderParams = { layoutSeed: number; levels: FlashLadderLevel[] };

/** Every answer in order, retries included, timed from the run start. */
export type FlashLadderInputs = { answers: { count: number; atMs: number }[] };

export function paramsFromSeed(seed: number): FlashLadderParams {
  const rng = createRng(seed);
  const levels = DOT_COUNT_RANGES.map(({ min, max }, i) => ({ dotCount: rng.int(min, max), flashMs: FLASH_MS_RANGE.max - FLASH_STEP_MS * i }));
  return { layoutSeed: rng.int(0, 0xffff_ffff), levels };
}

/** The dots for a level's `tryIndex`-th showing (0 first): the same every time, new for each retry. */
export function layoutFor(params: FlashLadderParams, level: number, tryIndex: number): Dot[] {
  // Mixes the three numbers into one 32-bit seed, so neighbouring levels and tries differ.
  const seed = (params.layoutSeed ^ Math.imul(level + 1, 0x9e37_79b1) ^ Math.imul(tryIndex + 1, 0x85eb_ca6b)) >>> 0;
  return placeDots(createRng(seed), params.levels[level].dotCount);
}

export const tolerance = (dotCount: number) => Math.max(1, Math.floor(dotCount * TOLERANCE_FRACTION));

/** Plays the answers: levels cleared, lives left, which showing of the current level is next, and whether the run is over. */
export function play(params: FlashLadderParams, inputs: FlashLadderInputs) {
  let cleared = 0;
  let lives = LIVES;
  let tryIndex = 0;
  for (const { count } of inputs.answers) {
    if (lives === 0 || cleared === params.levels.length) break;
    const { dotCount } = params.levels[cleared];
    if (Math.abs(count - dotCount) <= tolerance(dotCount)) {
      cleared++;
      tryIndex = 0;
    } else {
      lives--;
      tryIndex++;
    }
  }
  return { cleared, lives, tryIndex, finished: lives === 0 || cleared === params.levels.length };
}

const inputsSchema: z.ZodType<FlashLadderInputs> = z.object({
  answers: z
    .array(z.object({ count: z.number().int().min(0).max(999), atMs: z.number().nonnegative() }))
    .max(MAX_ROUNDS + LIVES)
    .refine((answers) => answers.every((answer, i) => i === 0 || answer.atMs > answers[i - 1].atMs), "answer times must rise"),
});

export const flashLadder: ChallengeModule<FlashLadderParams, FlashLadderInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { cleared, lives } = play(params, inputs);
    return Math.round((cleared + lives / LIVES) * 1000) / 1000;
  },
  finished: (params, inputs) => play(params, inputs).finished,
  inputsSchema,
  direction: "higher-better",
  lastInputMs: ({ answers }) => answers.at(-1)?.atMs ?? 0,
};
