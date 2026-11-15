import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Second Sense: Time Bank. Rounds of the Second Sense tap (tap when the round's target time has
 * passed, with the clock visible only at first). Each round's error comes out of one error
 * budget; a round survives if its error fits in what is left, and the run ends on the first round
 * that does not, or after the last round. Score = rounds survived + budget left as a fraction.
 *
 * The design calls it a "hold"; the current game is a tap and the design allows no new round
 * types, so the tap stays (DECISIONS, T139). All numbers below are placeholders tuned at the M5
 * play-test.
 */

export const BUDGET_MS = 3000;
export const MAX_ROUNDS = 8;

/** A round ends this many targets after its start. */
export const TIMEOUT_FACTOR = 3;

/** The pause between rounds, for the error reveal; the next round's clock starts after it. */
export const ROUND_GAP_MS = 1500;

const TARGET_STEP_MS = 100;

/** Round i's target range: one second longer per round, so the targets always rise. */
export const TARGET_RANGES_MS: readonly { min: number; max: number }[] = Array.from({ length: MAX_ROUNDS }, (_, i) => ({
  min: 3000 + 1000 * i,
  max: 3500 + 1000 * i,
}));

/** The visible clock shrinks by REVEAL_STEP_MS a round, from the max down to the min. */
const REVEAL_STEP_MS = 150;
export const REVEAL_RANGE_MS = { min: 1500 - REVEAL_STEP_MS * (MAX_ROUNDS - 1), max: 1500 } as const;

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
  const rounds = TARGET_RANGES_MS.map(({ min, max }, i) => {
    const targetMs = rng.int(min / TARGET_STEP_MS, max / TARGET_STEP_MS) * TARGET_STEP_MS;
    return { targetMs, revealMs: REVEAL_RANGE_MS.max - REVEAL_STEP_MS * i, timeoutMs: TIMEOUT_FACTOR * targetMs };
  });
  return { budgetMs: BUDGET_MS, rounds };
}

/** The round's error in ms, rounded to the ms; a missing or late tap costs the worst error. */
function roundErrorMs(round: TimeBankRound, tapMs: number | null): number {
  if (tapMs === null || tapMs > round.timeoutMs) return (TIMEOUT_FACTOR - 1) * round.targetMs;
  return Math.round(Math.abs(tapMs - round.targetMs));
}

/** Plays the taps against the budget: how many rounds survived, what is left, and whether a round failed. */
function play(params: TimeBankParams, inputs: TimeBankInputs): { survived: number; leftMs: number; failed: boolean } {
  let leftMs = params.budgetMs;
  const played = Math.min(inputs.tapsMs.length, params.rounds.length);
  for (let i = 0; i < played; i++) {
    const errorMs = roundErrorMs(params.rounds[i], inputs.tapsMs[i]);
    if (errorMs > leftMs) return { survived: i, leftMs: 0, failed: true };
    leftMs -= errorMs;
  }
  return { survived: played, leftMs, failed: false };
}

const inputsSchema: z.ZodType<TimeBankInputs> = z.object({
  // zod 4 numbers already reject NaN and Infinity.
  tapsMs: z.array(z.number().nonnegative().nullable()).max(MAX_ROUNDS),
});

export const timeBank: ChallengeModule<TimeBankParams, TimeBankInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { survived, leftMs } = play(params, inputs);
    return Math.round((survived + leftMs / params.budgetMs) * 1000) / 1000;
  },
  finished: (params, inputs) => play(params, inputs).failed || inputs.tapsMs.length >= params.rounds.length,
  inputsSchema,
  direction: "higher-better",
  // A missing tap adds nothing: its timeout needs the params, and a lower bound never refuses an
  // honest run. It always ends the run anyway, since its cost is more than the budget.
  lastInputMs: ({ tapsMs }) => tapsMs.reduce<number>((sum, tapMs, i) => sum + (i > 0 ? ROUND_GAP_MS : 0) + (tapMs ?? 0), 0),
};
