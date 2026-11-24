import { z } from "zod";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { bankScore, playBank } from "../shared/bank";
import { createRng, type Rng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Arrow Flip (T236): five rounds of six prompts. Each prompt shows an arrow, a direction word and
 * a cue, WORD or ARROW, that says which of the two to answer. Slow answers (past the round's
 * allowance), wrong answers and missed prompts drain one time bank; a prompt whose cost does not fit
 * what is left ends the run. Score = whole rounds survived + bank left as a fraction (T180). Every
 * number below is a proposal, owner to confirm (DECISIONS, T244).
 */

export const DIRECTIONS = ["left", "right", "up", "down"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type Cue = "word" | "arrow";

export const ROUNDS = 5;
export const PROMPTS_PER_ROUND = 6;
export const TOTAL_PROMPTS = ROUNDS * PROMPTS_PER_ROUND;
/** The time bank, set so about half of simulated careful players survive all five (engine.sim.test.ts). */
export const BANK_MS = 2200;
/** Prompts per round whose word disagrees with its arrow: 20% rising to 60% of six, rounded. */
export const MISMATCHES = [1, 2, 2, 3, 4] as const;
/** How long a correct answer may take before the bank starts to drain. */
export const ALLOWANCE_MS = [1400, 1200, 1000, 900, 800] as const;
/** No answer by then is a missed prompt. */
export const LIMIT_MS = [2400, 2100, 1800, 1600, 1400] as const;
/** From one prompt's answer (or its limit) to the next prompt; the feedback beat is its start. */
export const PROMPT_GAP_MS = 450;
export const FEEDBACK_MS = 300;
export const WRONG_COST_MS = 1000;
export const TIMEOUT_COST_MS = 1500;
/** The 3-2-1 before every round. */
export const ROUND_COUNTDOWN_MS = RUN_COUNTDOWN_MS;

export type ArrowFlipPrompt = { arrow: Direction; word: Direction; cue: Cue };
export type ArrowFlipRound = { allowanceMs: number; limitMs: number; prompts: ArrowFlipPrompt[] };
export type ArrowFlipParams = { bank: number; rounds: ArrowFlipRound[] };
/** An answer for prompt `prompt` (0 to 29, across the run), `atMs` from the game's start. */
export type ArrowFlipAnswer = { prompt: number; atMs: number; dir: Direction };
export type ArrowFlipInputs = { answers: ArrowFlipAnswer[]; endMs: number };

/** The direction the cue asks for. */
export const answerOf = (prompt: ArrowFlipPrompt): Direction => (prompt.cue === "arrow" ? prompt.arrow : prompt.word);

/** A seeded Fisher-Yates shuffle. */
function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const other = (rng: Rng, not: Direction) => rng.pick(DIRECTIONS.filter((d) => d !== not));

/**
 * One round: exactly MISMATCHES[k] mismatched prompts and three of each cue, both shuffled, and no
 * answer the same as the one before it (across rounds too), so repeating a swipe never pays.
 */
function drawRound(rng: Rng, k: number, previous: Direction | null): ArrowFlipRound {
  const mismatch = shuffle(rng, Array.from({ length: PROMPTS_PER_ROUND }, (_, i) => i < MISMATCHES[k]));
  const cues = shuffle(rng, Array.from({ length: PROMPTS_PER_ROUND }, (_, i): Cue => (i < PROMPTS_PER_ROUND / 2 ? "word" : "arrow")));
  let last = previous;
  const prompts = cues.map((cue, i) => {
    const answer = last === null ? rng.pick(DIRECTIONS) : other(rng, last);
    last = answer;
    const shown = mismatch[i] ? other(rng, answer) : answer;
    return cue === "arrow" ? { arrow: answer, word: shown, cue } : { arrow: shown, word: answer, cue };
  });
  return { allowanceMs: ALLOWANCE_MS[k], limitMs: LIMIT_MS[k], prompts };
}

export function paramsFromSeed(seed: number): ArrowFlipParams {
  const rng = createRng(seed);
  const rounds: ArrowFlipRound[] = [];
  for (let k = 0; k < ROUNDS; k++) {
    const previous = rounds.at(-1)?.prompts.at(-1);
    rounds.push(drawRound(rng, k, previous ? answerOf(previous) : null));
  }
  return { bank: BANK_MS, rounds };
}

/** What an answer costs: the slow part past the allowance, plus WRONG_COST_MS if it is wrong. */
export function answerCost(correct: boolean, reactionMs: number, allowanceMs: number): number {
  const slow = Math.max(0, reactionMs - allowanceMs);
  return correct ? slow : WRONG_COST_MS + slow;
}

/** How a prompt ended: an answer (right or wrong, and its cost) or no answer by the limit. */
type Settled = { kind: "answer"; prompt: number; atMs: number; dir: Direction; correct: boolean; cost: number } | { kind: "timeout"; prompt: number; atMs: number; cost: number };
export type ArrowFlipOutcome = Settled & { survived: boolean };

/**
 * Plays the answers up to `endMs`: the prompt on screen and when it appeared, its limit, every
 * prompt's cost, the bank, the last outcome and whether the run is over. Answers for another prompt,
 * or before the prompt appeared, are ignored; a prompt with no answer by its limit is missed.
 */
export function play(params: ArrowFlipParams, { answers, endMs }: ArrowFlipInputs) {
  const costs: number[] = [];
  const total = params.rounds.length * PROMPTS_PER_ROUND;
  let appearsAt = ROUND_COUNTDOWN_MS;
  let last: ArrowFlipOutcome | null = null;
  const roundOf = (p: number) => params.rounds[Math.floor(p / PROMPTS_PER_ROUND)];
  const promptAt = (p: number) => roundOf(p).prompts[p % PROMPTS_PER_ROUND];
  const over = () => costs.length === total || playBank(params.bank, costs).failed;
  const deadline = () => appearsAt + roundOf(costs.length).limitMs;
  /** Settles the prompt on screen at `atMs` and brings up the next, after a 3-2-1 if it starts a round. */
  const settle = (outcome: Settled) => {
    costs.push(outcome.cost);
    last = { ...outcome, survived: !playBank(params.bank, costs).failed };
    appearsAt = outcome.atMs + PROMPT_GAP_MS + (costs.length % PROMPTS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
  };
  const missed = () => settle({ kind: "timeout", prompt: costs.length, atMs: deadline(), cost: TIMEOUT_COST_MS });
  for (const answer of answers) {
    while (!over() && answer.atMs > deadline()) missed();
    if (over()) break;
    if (answer.prompt !== costs.length || answer.atMs < appearsAt) continue;
    const p = costs.length;
    const correct = answer.dir === answerOf(promptAt(p));
    settle({ kind: "answer", prompt: p, atMs: answer.atMs, dir: answer.dir, correct, cost: answerCost(correct, answer.atMs - appearsAt, roundOf(p).allowanceMs) });
  }
  while (!over() && endMs > deadline()) missed();
  const finished = over();
  const bank = playBank(params.bank, costs);
  const prompt = Math.min(costs.length, total - 1);
  return {
    prompt,
    round: Math.floor(prompt / PROMPTS_PER_ROUND),
    costs,
    promptsSurvived: bank.survived,
    roundsSurvived: Math.min(params.rounds.length, Math.floor(bank.survived / PROMPTS_PER_ROUND)),
    left: bank.left,
    failed: bank.failed,
    appearsAt: finished ? null : appearsAt,
    deadline: finished ? null : deadline(),
    // `last` is assigned inside closures TypeScript cannot follow, so it still narrows it to null.
    last: last as ArrowFlipOutcome | null,
    finished,
  };
}

const inputsSchema: z.ZodType<ArrowFlipInputs> = z
  .object({
    answers: z
      .array(z.object({ prompt: z.number().int().min(0).max(TOTAL_PROMPTS - 1), atMs: z.number().nonnegative().finite(), dir: z.enum(DIRECTIONS) }))
      .max(TOTAL_PROMPTS)
      .refine((answers) => answers.every((a, i) => i === 0 || a.atMs > answers[i - 1].atMs), "answer times must rise"),
    endMs: z.number().nonnegative().finite(),
  })
  .refine(({ answers, endMs }) => endMs >= (answers.at(-1)?.atMs ?? 0), "the run cannot end before its last answer");

export const arrowFlip: ChallengeModule<ArrowFlipParams, ArrowFlipInputs> = {
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
