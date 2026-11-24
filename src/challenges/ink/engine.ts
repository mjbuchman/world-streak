import { z } from "zod";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { bankScore, playBank } from "../shared/bank";
import { createRng, type Rng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Ink (T249): five rounds of eight colour words, each drawn in an ink that may differ from the word.
 * The answer is always the ink. Slow answers (past the round's allowance), wrong answers and missed
 * words drain one time bank; a word whose cost does not fit what is left ends the run. Score = whole
 * rounds survived + bank left as a fraction (T180). Every number below is a proposal, owner to
 * confirm (DECISIONS, T244).
 */

/** No green: red and green are the pair most colour-blind players confuse. */
export const COLOURS = ["red", "blue", "yellow", "black"] as const;
export type Colour = (typeof COLOURS)[number];

export const ROUNDS = 5;
export const WORDS_PER_ROUND = 8;
export const TOTAL_WORDS = ROUNDS * WORDS_PER_ROUND;
/** The time bank, set so 50 to 70% of simulated careful players survive all five (engine.sim.test.ts). */
export const BANK_MS = 4000;
/** Words per round whose ink differs from the word. */
export const MISMATCHES = [2, 3, 4, 5, 6] as const;
/** How long a correct answer may take before the bank starts to drain. */
export const ALLOWANCE_MS = [1200, 1050, 950, 850, 800] as const;
/** No answer by then is a missed word. */
export const LIMIT_MS = [2500, 2250, 2000, 1750, 1500] as const;
/** From one word's answer (or its limit) to the next word; the feedback beat is its start. */
export const WORD_GAP_MS = 400;
export const WRONG_COST_MS = 1000;
export const TIMEOUT_COST_MS = 1500;
/** The 3-2-1 before every round. */
export const ROUND_COUNTDOWN_MS = RUN_COUNTDOWN_MS;

export type InkWord = { word: Colour; ink: Colour };
export type InkRound = { allowanceMs: number; limitMs: number; words: InkWord[] };
export type InkParams = { bank: number; rounds: InkRound[] };
/** An answer for word `word` (0 to 39, across the run), `atMs` from the game's start. */
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
 * One round: exactly MISMATCHES[k] mismatched words in shuffled places, and no ink the same as the
 * one before it (across rounds too), so repeating a tap never pays.
 */
function drawRound(rng: Rng, k: number, previous: Colour | null): InkRound {
  const mismatch = shuffle(rng, Array.from({ length: WORDS_PER_ROUND }, (_, i) => i < MISMATCHES[k]));
  let last = previous;
  const words = mismatch.map((differs) => {
    const ink = last === null ? rng.pick(COLOURS) : other(rng, last);
    last = ink;
    return { word: differs ? other(rng, ink) : ink, ink };
  });
  return { allowanceMs: ALLOWANCE_MS[k], limitMs: LIMIT_MS[k], words };
}

export function paramsFromSeed(seed: number): InkParams {
  const rng = createRng(seed);
  const rounds: InkRound[] = [];
  for (let k = 0; k < ROUNDS; k++) rounds.push(drawRound(rng, k, rounds.at(-1)?.words.at(-1)?.ink ?? null));
  return { bank: BANK_MS, rounds };
}

/** What an answer costs: the slow part past the allowance, plus WRONG_COST_MS if it is wrong. */
export function answerCost(correct: boolean, reactionMs: number, allowanceMs: number): number {
  const slow = Math.max(0, reactionMs - allowanceMs);
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
  const total = params.rounds.length * WORDS_PER_ROUND;
  let appearsAt = ROUND_COUNTDOWN_MS;
  let last: InkOutcome | null = null;
  const roundOf = (w: number) => params.rounds[Math.floor(w / WORDS_PER_ROUND)];
  const wordAt = (w: number) => roundOf(w).words[w % WORDS_PER_ROUND];
  const over = () => costs.length === total || playBank(params.bank, costs).failed;
  const deadline = () => appearsAt + roundOf(costs.length).limitMs;
  /** Settles the word on screen and brings up the next, after a 3-2-1 if it starts a round. */
  const settle = (outcome: Settled) => {
    costs.push(outcome.cost);
    last = { ...outcome, survived: !playBank(params.bank, costs).failed };
    appearsAt = outcome.atMs + WORD_GAP_MS + (costs.length % WORDS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
  };
  const missed = () => settle({ kind: "timeout", word: costs.length, atMs: deadline(), cost: TIMEOUT_COST_MS });
  for (const answer of answers) {
    while (!over() && answer.atMs > deadline()) missed();
    if (over()) break;
    if (answer.word !== costs.length || answer.atMs < appearsAt) continue;
    const w = costs.length;
    const correct = answer.colour === wordAt(w).ink;
    settle({ kind: "answer", word: w, atMs: answer.atMs, colour: answer.colour, correct, cost: answerCost(correct, answer.atMs - appearsAt, roundOf(w).allowanceMs) });
  }
  while (!over() && endMs > deadline()) missed();
  const finished = over();
  const bank = playBank(params.bank, costs);
  const word = Math.min(costs.length, total - 1);
  return {
    word,
    round: Math.floor(word / WORDS_PER_ROUND),
    costs,
    wordsSurvived: bank.survived,
    roundsSurvived: Math.min(params.rounds.length, Math.floor(bank.survived / WORDS_PER_ROUND)),
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
      .array(z.object({ word: z.number().int().min(0).max(TOTAL_WORDS - 1), atMs: z.number().nonnegative().finite(), colour: z.enum(COLOURS) }))
      .max(TOTAL_WORDS)
      .refine((answers) => answers.every((a, i) => i === 0 || a.atMs > answers[i - 1].atMs), "answer times must rise"),
    endMs: z.number().nonnegative().finite(),
  })
  .refine(({ answers, endMs }) => endMs >= (answers.at(-1)?.atMs ?? 0), "the run cannot end before its last answer");

export const ink: ChallengeModule<InkParams, InkInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { roundsSurvived, left } = play(params, inputs);
    return bankScore(roundsSurvived, left, params.bank);
  },
  finished: (params, inputs) => play(params, inputs).finished,
  inputsSchema,
  direction: "higher-better",
  // The game's clock runs through every 3-2-1 and feedback beat, so the run's end already holds them.
  lastInputMs: ({ endMs }) => endMs,
};
