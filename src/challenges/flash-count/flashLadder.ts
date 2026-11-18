import { z } from "zod";
import { bankScore, playBank } from "../shared/bank";
import { ladderRanges } from "../shared/ladder";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";
import { placeDots, type Dot } from "./dots";

/**
 * Swift Sum (T184): ROUNDS flashes of dots, each with more dots and a shorter flash. Every dot an
 * answer is off by comes out of one bank of BANK dots; the run ends at the first round whose miss
 * is bigger than what is left (the shared bank rule). Score = rounds survived + the bank left as
 * a fraction. All numbers below are placeholders (DECISIONS, T184).
 */

export const ROUNDS = 5;
export const BANK = 10;
/** How long "Right on" or "Off by N" shows after an answer, before the next round's 3-2-1. */
export const REVEAL_MS = 1200;

/** Round i's dot count range: three more dots a round, so the counts always rise. */
export const DOT_COUNT_RANGES = ladderRanges(ROUNDS, 6, 3, 5);

/** The flash shortens by FLASH_STEP_MS a round, from the max down to the min. */
const FLASH_STEP_MS = 100;
export const FLASH_MS_RANGE = { min: 1800 - FLASH_STEP_MS * (ROUNDS - 1), max: 1800 } as const;

export type FlashLadderLevel = { dotCount: number; flashMs: number };
/** One round as shown: its count, its flash, and its layout. */
export type FlashShowing = FlashLadderLevel & { dots: Dot[] };

/** The rounds, the bank, and the seed every layout is built from (a layout is drawn when it is shown). */
export type FlashLadderParams = { layoutSeed: number; bank: number; levels: FlashLadderLevel[] };

/** One answer a round, timed from the run start. */
export type FlashLadderInputs = { answers: { count: number; atMs: number }[] };

export function paramsFromSeed(seed: number): FlashLadderParams {
  const rng = createRng(seed);
  const levels = DOT_COUNT_RANGES.map(({ min, max }, i) => ({ dotCount: rng.int(min, max), flashMs: FLASH_MS_RANGE.max - FLASH_STEP_MS * i }));
  return { layoutSeed: rng.int(0, 0xffff_ffff), bank: BANK, levels };
}

/** Round `level`'s dots: the same every time it is drawn, and different for each round. */
export function layoutFor(params: FlashLadderParams, level: number): Dot[] {
  // Mixes the two numbers into one 32-bit seed, so neighbouring rounds differ.
  const seed = (params.layoutSeed ^ Math.imul(level + 1, 0x9e37_79b1)) >>> 0;
  return placeDots(createRng(seed), params.levels[level].dotCount);
}

/** One dot of the bank for every dot missed or counted too many. */
export const roundCost = (dotCount: number, count: number) => Math.abs(count - dotCount);

/** Plays the answers against the bank; answers past the last round are ignored. */
export function play(params: FlashLadderParams, { answers }: FlashLadderInputs) {
  const costs = answers.slice(0, params.levels.length).map(({ count }, i) => roundCost(params.levels[i].dotCount, count));
  return playBank(params.bank, costs);
}

const inputsSchema: z.ZodType<FlashLadderInputs> = z.object({
  answers: z
    .array(z.object({ count: z.number().int().min(0).max(999), atMs: z.number().nonnegative() }))
    .max(ROUNDS)
    .refine((answers) => answers.every((answer, i) => i === 0 || answer.atMs > answers[i - 1].atMs), "answer times must rise"),
});

export const flashLadder: ChallengeModule<FlashLadderParams, FlashLadderInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { survived, left } = play(params, inputs);
    return bankScore(survived, left, params.bank);
  },
  finished: (params, inputs) => {
    const { survived, failed } = play(params, inputs);
    return failed || survived >= params.levels.length;
  },
  inputsSchema,
  direction: "higher-better",
  // Answers are timed from the run's start, so the last one already includes every 3-2-1, flash and reveal.
  lastInputMs: ({ answers }) => answers.at(-1)?.atMs ?? 0,
};
