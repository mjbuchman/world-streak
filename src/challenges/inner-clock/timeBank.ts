import { z } from "zod";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { bankScore, playBank, type BankResult } from "../shared/bank";
import { ladderRanges } from "../shared/ladder";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Second Sense: Time Bank (M6, T181). Four rounds of the Second Sense tap: tap when the round's
 * hidden interval (15 to 25 s) has passed, with the clock visible for its first 2 s. Each round's
 * error comes out of one 10 s bank by the shared bank rule (T180). Score = rounds survived + bank
 * left as a fraction. All numbers below are placeholders (DECISIONS, T198).
 *
 * The design calls it a "hold"; the game is a tap and the design allows no new round types, so the
 * tap stays (DECISIONS, T139).
 */

export const BUDGET_MS = 10_000;
export const ROUNDS = 4;

/** The clock shows for this long at the start of every round, then fades. */
export const REVEAL_MS = 2000;

/** The pause between rounds, for the error reveal; the next round's 3-2-1 starts after it. */
export const ROUND_GAP_MS = 1500;

/** The 3-2-1 before every round's clock. */
export const ROUND_COUNTDOWN_MS = RUN_COUNTDOWN_MS;

const TARGET_STEP_MS = 100;

/** Round i's hidden interval: 15.0 to 17.4 s, then 2.5 s later per round, so a run covers 15 to 25 s. */
export const TARGET_RANGES_MS = ladderRanges(ROUNDS, 15_000, 2_500, 2_400);

export type TimeBankRound = {
  /** When the player should tap, in ms from the round's start. */
  targetMs: number;
  /** How long the clock is visible at the round's start. */
  revealMs: number;
  /** When the round ends without a tap, in ms from its start. */
  timeoutMs: number;
};

export type TimeBankParams = { budgetMs: number; rounds: TimeBankRound[] };

/** One tap per round played, in ms from that round's start, or null when it timed out. */
export type TimeBankInputs = { tapsMs: (number | null)[] };

export function paramsFromSeed(seed: number): TimeBankParams {
  const rng = createRng(seed);
  const rounds = TARGET_RANGES_MS.map(({ min, max }) => {
    const targetMs = rng.int(min / TARGET_STEP_MS, max / TARGET_STEP_MS) * TARGET_STEP_MS;
    // A tap later than this costs more than the whole bank anyway, so the round can end there.
    return { targetMs, revealMs: REVEAL_MS, timeoutMs: targetMs + BUDGET_MS };
  });
  return { budgetMs: BUDGET_MS, rounds };
}

/** The round's error in ms, rounded to the ms; a missing or late tap costs more than the bank. */
export function roundErrorMs(round: TimeBankRound, tapMs: number | null, budgetMs: number): number {
  if (tapMs === null || tapMs > round.timeoutMs) return budgetMs + 1;
  return Math.round(Math.abs(tapMs - round.targetMs));
}

/** Plays the taps against the bank: how many rounds survived, what is left, and whether a round failed. */
export function play(params: TimeBankParams, inputs: TimeBankInputs): BankResult {
  const costs = inputs.tapsMs.slice(0, params.rounds.length).map((tapMs, i) => roundErrorMs(params.rounds[i], tapMs, params.budgetMs));
  return playBank(params.budgetMs, costs);
}

const inputsSchema: z.ZodType<TimeBankInputs> = z.object({
  // zod 4 numbers already reject NaN and Infinity.
  tapsMs: z.array(z.number().nonnegative().nullable()).max(ROUNDS),
});

export const timeBank: ChallengeModule<TimeBankParams, TimeBankInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { survived, left } = play(params, inputs);
    return bankScore(survived, left, params.budgetMs);
  },
  finished: (params, inputs) => play(params, inputs).failed || inputs.tapsMs.length >= params.rounds.length,
  inputsSchema,
  direction: "higher-better",
  // Each later round adds the reveal gap and its 3-2-1; the first round's 3-2-1 is in the cheat
  // check's load allowance. A round with no tap lasted until its timeout.
  lastInputMs: ({ tapsMs }, params) =>
    tapsMs.reduce<number>((sum, tapMs, i) => sum + (i > 0 ? ROUND_GAP_MS + ROUND_COUNTDOWN_MS : 0) + (tapMs ?? params.rounds[i].timeoutMs), 0),
};
