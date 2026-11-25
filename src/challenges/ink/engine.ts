import { z } from "zod";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { bankScore, playBank } from "../shared/bank";
import { createRng, type Rng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Ink (T249, one run since T254): 40 colour words in a row at one steady pace, each drawn in an ink
 * that may differ from the word. The answer is always the ink. Slow answers (past the allowance),
 * wrong answers and missed words drain one time bank; a word whose cost does not fit what is left
 * ends the run. Score = words survived + bank left as a fraction, 0 to 41. Every number below is a
 * proposal, owner to confirm (DECISIONS, T254).
 */

/** No green: red and green are the pair most colour-blind players confuse. */
export const COLOURS = ["red", "blue", "yellow", "black"] as const;
export type Colour = (typeof COLOURS)[number];

export const WORDS = 40;
/** The run is drawn in stretches of this many words, each with an exact number of mismatches. */
export const STRETCH = 8;
/** Mismatched words per stretch: 50% rising to 87.5% (90% of 8 is not whole, so 7 is the nearest). */
export const MISMATCHES_PER_STRETCH = [4, 5, 6, 7, 7] as const;
/** The time bank, set so 50 to 70% of simulated careful players survive all 40 (engine.sim.test.ts). */
export const BANK_MS = 3200;
/** How long a correct answer may take before the bank starts to drain. */
export const ALLOWANCE_MS = 1000;
/** No answer by then is a missed word. */
export const LIMIT_MS = 2000;
/** From one word's answer (or its limit) to the next word; the feedback beat is its start. */
export const WORD_GAP_MS = 400;
/** The feedback beat after each word, inside WORD_GAP_MS. */
export const FEEDBACK_MS = 300;
export const WRONG_COST_MS = 1000;
export const TIMEOUT_COST_MS = 1500;
/** The one 3-2-1 before the first word. */
export { RUN_COUNTDOWN_MS };

/** The pass target the T239 migration will store: survive all 40 words. */
export const DEFAULT_PASS_TARGET = WORDS;

export type InkWord = { word: Colour; ink: Colour };
export type InkParams = { bank: number; words: InkWord[] };
/** An answer for word `word` (0 to 39), `atMs` from the game's start. */
export type InkAnswer = { word: number; atMs: number; colour: Colour };
export type InkInputs = { answers: InkAnswer[]; endMs: number };

/** A seeded Fisher-Yates shuffle. */
function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const other = (rng: Rng, not: Colour) => rng.pick(COLOURS.filter((c) => c !== not));

/**
 * The 40 words: each stretch has exactly its share of mismatches in shuffled places, and no ink is
 * the same as the one before it, so repeating a tap never pays.
 */
export function paramsFromSeed(seed: number): InkParams {
  const rng = createRng(seed);
  const mismatch = MISMATCHES_PER_STRETCH.flatMap((n) => shuffle(rng, Array.from({ length: STRETCH }, (_, i) => i < n)));
  let last: Colour | null = null;
  const words = mismatch.map((differs) => {
    const ink: Colour = last === null ? rng.pick(COLOURS) : other(rng, last);
    last = ink;
    return { word: differs ? other(rng, ink) : ink, ink };
  });
  return { bank: BANK_MS, words };
}

/** What an answer costs: the slow part past the allowance, plus WRONG_COST_MS if it is wrong. */
export function answerCost(correct: boolean, reactionMs: number): number {
  const slow = Math.max(0, reactionMs - ALLOWANCE_MS);
  return correct ? slow : WRONG_COST_MS + slow;
}

/** How a word ended: an answer (right or wrong, and its cost) or no answer by the limit. */
type Settled = { kind: "answer"; word: number; atMs: number; colour: Colour; correct: boolean; cost: number } | { kind: "timeout"; word: number; atMs: number; cost: number };
export type InkOutcome = Settled & { survived: boolean };

/**
 * Plays the answers up to `endMs`: the word on screen and when it appeared, its limit, every word's
 * cost, the bank, the last outcome and whether the run is over. Answers for another word, or before
 * the word appeared, are ignored; a word with no answer by its limit is missed.
 */
export function play(params: InkParams, { answers, endMs }: InkInputs) {
  const costs: number[] = [];
  const total = params.words.length;
  let appearsAt = RUN_COUNTDOWN_MS;
  let last: InkOutcome | null = null;
  const over = () => costs.length === total || playBank(params.bank, costs).failed;
  const deadline = () => appearsAt + LIMIT_MS;
  /** Settles the word on screen and brings up the next one after the gap. */
  const settle = (outcome: Settled) => {
    costs.push(outcome.cost);
    last = { ...outcome, survived: !playBank(params.bank, costs).failed };
    appearsAt = outcome.atMs + WORD_GAP_MS;
  };
  const missed = () => settle({ kind: "timeout", word: costs.length, atMs: deadline(), cost: TIMEOUT_COST_MS });
  for (const answer of answers) {
    while (!over() && answer.atMs > deadline()) missed();
    if (over()) break;
    if (answer.word !== costs.length || answer.atMs < appearsAt) continue;
    const w = costs.length;
    const correct = answer.colour === params.words[w].ink;
    settle({ kind: "answer", word: w, atMs: answer.atMs, colour: answer.colour, correct, cost: answerCost(correct, answer.atMs - appearsAt) });
  }
  while (!over() && endMs > deadline()) missed();
  const finished = over();
  const bank = playBank(params.bank, costs);
  return {
    word: Math.min(costs.length, total - 1),
    costs,
    wordsSurvived: bank.survived,
    left: bank.left,
    failed: bank.failed,
    appearsAt: finished ? null : appearsAt,
    deadline: finished ? null : deadline(),
    // `last` is assigned inside closures TypeScript cannot follow, so it still narrows it to null.
    last: last as InkOutcome | null,
    finished,
  };
}

const inputsSchema: z.ZodType<InkInputs> = z
  .object({
    answers: z
      .array(z.object({ word: z.number().int().min(0).max(WORDS - 1), atMs: z.number().nonnegative().finite(), colour: z.enum(COLOURS) }))
      .max(WORDS)
      .refine((answers) => answers.every((a, i) => i === 0 || a.atMs > answers[i - 1].atMs), "answer times must rise"),
    endMs: z.number().nonnegative().finite(),
  })
  .refine(({ answers, endMs }) => endMs >= (answers.at(-1)?.atMs ?? 0), "the run cannot end before its last answer");

export const ink: ChallengeModule<InkParams, InkInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { wordsSurvived, left } = play(params, inputs);
    return bankScore(wordsSurvived, left, params.bank);
  },
  finished: (params, inputs) => play(params, inputs).finished,
  inputsSchema,
  direction: "higher-better",
  // The game's clock runs through the 3-2-1 and every feedback beat, so the run's end already holds them.
  lastInputMs: ({ endMs }) => endMs,
};
