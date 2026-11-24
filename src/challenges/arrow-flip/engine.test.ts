import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWANCE_MS,
  LIMIT_MS,
  MISMATCHES,
  PROMPTS_PER_ROUND,
  PROMPT_GAP_MS,
  ROUNDS,
  ROUND_COUNTDOWN_MS,
  TIMEOUT_COST_MS,
  TOTAL_PROMPTS,
  WRONG_COST_MS,
  answerCost,
  answerOf,
  arrowFlip,
  paramsFromSeed,
  play,
  type ArrowFlipAnswer,
  type ArrowFlipParams,
  type ArrowFlipPrompt,
  type Direction,
} from "./engine";

// Explicit params: a 6 000 ms bank and five rounds of the same six prompts, alternating answers.
const PROMPTS: ArrowFlipPrompt[] = [
  { arrow: "left", word: "left", cue: "word" },
  { arrow: "up", word: "right", cue: "word" },
  { arrow: "left", word: "down", cue: "arrow" },
  { arrow: "up", word: "up", cue: "arrow" },
  { arrow: "down", word: "down", cue: "word" },
  { arrow: "right", word: "left", cue: "arrow" },
];
const params: ArrowFlipParams = {
  bank: 6000,
  rounds: ALLOWANCE_MS.map((allowanceMs, k) => ({ allowanceMs, limitMs: LIMIT_MS[k], prompts: PROMPTS })),
};
/** A 300 ms bank, for the edge of what fits. */
const small: ArrowFlipParams = { ...params, bank: 300 };
const promptOf =(p: number) => params.rounds[Math.floor(p / PROMPTS_PER_ROUND)].prompts[p % PROMPTS_PER_ROUND];
const allowanceOf = (p: number) => ALLOWANCE_MS[Math.floor(p / PROMPTS_PER_ROUND)];
const wrongFor = (prompt: ArrowFlipPrompt): Direction => (answerOf(prompt) === "left" ? "right" : "left");

/**
 * Answers prompts 0 to `reactions.length - 1` in order; `reactions[p]` is the ms after prompt p
 * appeared, and `wrong` lists the prompts answered wrongly. Each next prompt follows the gap (and
 * a 3-2-1 at a round's start), as the engine times them.
 */
function answer(reactions: number[], wrong: number[] = []) {
  const answers: ArrowFlipAnswer[] = [];
  let appears = ROUND_COUNTDOWN_MS;
  reactions.forEach((reaction, p) => {
    const atMs = appears + reaction;
    answers.push({ prompt: p, atMs, dir: wrong.includes(p) ? wrongFor(promptOf(p)) : answerOf(promptOf(p)) });
    appears = atMs + PROMPT_GAP_MS + ((p + 1) % PROMPTS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
  });
  return { answers, endMs: answers.at(-1)?.atMs ?? 0 };
}
const fast = (n: number) => Array.from({ length: n }, () => 500);

describe("Arrow Flip params (T236)", () => {
  const seeds = Array.from({ length: 1000 }, (_, seed) => seed);

  it("is deterministic per seed", () => {
    expect(paramsFromSeed(42)).toEqual(paramsFromSeed(42));
    expect(paramsFromSeed(42)).not.toEqual(paramsFromSeed(43));
  });

  it("gives every seed the exact mismatch and cue counts per round, the ladder's timings and no repeated answer", () => {
    for (const seed of seeds) {
      const { bank, rounds } = paramsFromSeed(seed);
      expect(bank).toBe(arrowFlip.paramsFromSeed(seed).bank);
      expect(rounds).toHaveLength(ROUNDS);
      rounds.forEach((round, k) => {
        expect(round.prompts).toHaveLength(PROMPTS_PER_ROUND);
        expect(round.prompts.filter((p) => p.arrow !== p.word)).toHaveLength(MISMATCHES[k]);
        expect(round.prompts.filter((p) => p.cue === "word")).toHaveLength(PROMPTS_PER_ROUND / 2);
        expect([round.allowanceMs, round.limitMs]).toEqual([ALLOWANCE_MS[k], LIMIT_MS[k]]);
      });
      const answers = rounds.flatMap((r) => r.prompts.map(answerOf));
      expect(answers.every((a, i) => i === 0 || a !== answers[i - 1])).toBe(true);
    }
  });

  it("follows the proposed ladder", () => {
    expect(MISMATCHES).toEqual([1, 2, 2, 3, 4]);
    expect(ALLOWANCE_MS).toEqual([1400, 1200, 1000, 900, 800]);
    expect(LIMIT_MS).toEqual([2400, 2100, 1800, 1600, 1400]);
  });

  it("puts mismatches and cues in different places across seeds", () => {
    const layouts = new Set(seeds.slice(0, 50).map((seed) => JSON.stringify(paramsFromSeed(seed).rounds[0].prompts.map((p) => [p.cue, p.arrow === p.word]))));
    expect(layouts.size).toBeGreaterThan(10);
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG or the draw changes these)", (seed) => {
    const rounds = paramsFromSeed(seed).rounds.map((r) => r.prompts.map((p) => `${p.cue}:${p.arrow}/${p.word}`).join(" "));
    expect(rounds).toMatchSnapshot();
  });

  it("uses no Math.random, Date.now or DOM", () => {
    const source = readFileSync(new URL("./engine.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now|document\.|window\./);
  });
});

describe("Arrow Flip score (T236)", () => {
  it("costs only the slow part of a right answer and adds the wrong cost to a wrong one", () => {
    expect(answerCost(true, 1400, 1400)).toBe(0);
    expect(answerCost(true, 1700, 1400)).toBe(300);
    expect(answerCost(false, 900, 1400)).toBe(WRONG_COST_MS);
    expect(answerCost(false, 1500, 1400)).toBe(WRONG_COST_MS + 100);
  });

  it("scores 5 + 1 = 6 for all 30 prompts right within the allowance", () => {
    const inputs = answer(Array.from({ length: TOTAL_PROMPTS }, (_, p) => allowanceOf(p)));
    expect(arrowFlip.score(params, inputs)).toBe(6);
    expect(arrowFlip.finished(params, inputs)).toBe(true);
  });

  it("costs a wrong answer at the allowance exactly 1 000, leaving 5 000 of 6 000", () => {
    const inputs = answer(Array.from({ length: TOTAL_PROMPTS }, (_, p) => allowanceOf(p)), [2]);
    const state = play(params, inputs);
    expect(state.costs[2]).toBe(1000);
    expect(state.left).toBe(5000);
    expect(arrowFlip.score(params, inputs)).toBe(5.833);
  });

  it("costs a right answer 300 ms over the allowance 300", () => {
    expect(play(params, answer([1700])).costs).toEqual([300]);
  });

  it("survives a cost equal to what is left and ends the run 1 ms more", () => {
    const exact = play(small, answer([1700]));
    expect(exact.costs).toEqual([300]);
    expect([exact.failed, exact.left, exact.promptsSurvived]).toEqual([false, 0, 1]);
    const over = play(small, answer([1701]));
    expect([over.failed, over.finished, over.roundsSurvived]).toEqual([true, true, 0]);
  });

  it("scores the whole rounds before a bust: 2 when the run ends in round 3", () => {
    // Prompts 12 to 17 are round 3; six wrong answers 100 ms slow there bust a 6 000 bank on the sixth.
    const inputs = answer([...fast(12), ...Array.from({ length: 6 }, () => 1100)], [12, 13, 14, 15, 16, 17]);
    const state = play(params, inputs);
    expect([state.failed, state.promptsSurvived, state.roundsSurvived]).toEqual([true, 17, 2]);
    expect(arrowFlip.score(params, inputs)).toBe(2);
  });

  it("costs a missed prompt 1 500 and moves on to the next prompt after the gap", () => {
    const limit = ROUND_COUNTDOWN_MS + LIMIT_MS[0];
    const state = play(params, { answers: [], endMs: limit + 1 });
    expect(state.costs).toEqual([TIMEOUT_COST_MS]);
    expect(state.last).toEqual({ kind: "timeout", prompt: 0, atMs: limit, cost: TIMEOUT_COST_MS, survived: true });
    expect(state.appearsAt).toBe(limit + PROMPT_GAP_MS);
    // A miss is counted once its limit has passed, not at it.
    expect(play(params, { answers: [], endMs: limit }).costs).toEqual([]);
    // An answer after a miss is for the next prompt.
    const next = play(params, { answers: [{ prompt: 1, atMs: limit + PROMPT_GAP_MS + 300, dir: answerOf(PROMPTS[1]) }], endMs: limit + 1000 });
    expect(next.costs).toEqual([TIMEOUT_COST_MS, 0]);
  });

  it("ignores an answer before the prompt appeared, or for another prompt", () => {
    const early = { prompt: 0, atMs: ROUND_COUNTDOWN_MS - 1, dir: answerOf(PROMPTS[0]) };
    const otherPrompt = { prompt: 3, atMs: ROUND_COUNTDOWN_MS + 100, dir: answerOf(PROMPTS[3]) };
    const right = { prompt: 0, atMs: ROUND_COUNTDOWN_MS + 200, dir: answerOf(PROMPTS[0]) };
    const state = play(params, { answers: [early, otherPrompt, right], endMs: right.atMs });
    expect(state.costs).toEqual([0]);
    expect(state.last).toMatchObject({ kind: "answer", prompt: 0, atMs: right.atMs, correct: true });
  });

  it("counts the word's direction as wrong when the cue is arrow", () => {
    // Prompt 2 shows a left arrow over the word DOWN with the ARROW cue.
    const inputs = answer([500, 500]);
    inputs.answers.push({ prompt: 2, atMs: inputs.endMs + PROMPT_GAP_MS + 500, dir: "down" });
    inputs.endMs = inputs.answers[2].atMs;
    const state = play(params, inputs);
    expect(state.costs).toEqual([0, 0, WRONG_COST_MS]);
    expect(state.last).toMatchObject({ correct: false, dir: "down" });
  });

  it("reports the prompt on screen, its round, when it appears and its limit", () => {
    const state = play(params, answer(fast(6)));
    expect([state.prompt, state.round]).toEqual([6, 1]);
    const appears = ROUND_COUNTDOWN_MS + 6 * 500 + 5 * PROMPT_GAP_MS + PROMPT_GAP_MS + ROUND_COUNTDOWN_MS;
    expect([state.appearsAt, state.deadline]).toEqual([appears, appears + LIMIT_MS[1]]);
    const over = play(params, answer(fast(TOTAL_PROMPTS)));
    expect([over.finished, over.prompt, over.appearsAt, over.deadline]).toEqual([true, TOTAL_PROMPTS - 1, null, null]);
  });

  it("stops at a bust and ignores answers after it", () => {
    const inputs = answer([1701, 500]);
    expect(play(small, inputs).costs).toEqual([301]);
  });

  it("stays within 0 to ROUNDS + 1 and gives the same score to the same inputs", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const seeded = paramsFromSeed(seed);
      const reactions = Array.from({ length: TOTAL_PROMPTS }, (_, p) => 300 + ((seed * 37 + p * 101) % 900));
      const answers: ArrowFlipAnswer[] = [];
      let appears = ROUND_COUNTDOWN_MS;
      reactions.forEach((reaction, p) => {
        const prompt = seeded.rounds[Math.floor(p / PROMPTS_PER_ROUND)].prompts[p % PROMPTS_PER_ROUND];
        const atMs = appears + reaction;
        answers.push({ prompt: p, atMs, dir: (seed + p) % 7 === 0 ? prompt.word : answerOf(prompt) });
        appears = atMs + PROMPT_GAP_MS + ((p + 1) % PROMPTS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
      });
      const inputs = { answers, endMs: answers.at(-1)!.atMs };
      const score = arrowFlip.score(seeded, inputs);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(ROUNDS + 1);
      expect(arrowFlip.score(seeded, inputs)).toBe(score);
    }
  });
});

describe("Arrow Flip module (T236)", () => {
  it("is higher-better and ends at the run's end", () => {
    expect(arrowFlip.direction).toBe("higher-better");
    expect(arrowFlip.lastInputMs({ answers: [], endMs: 1234 }, params)).toBe(1234);
    expect(arrowFlip.finished(params, { answers: [], endMs: 0 })).toBe(false);
  });

  it("accepts a valid run and rejects bad answers", () => {
    const ok = answer(fast(3));
    expect(arrowFlip.inputsSchema.safeParse(ok).success).toBe(true);
    const bad = (answers: unknown[], endMs = 10_000) => arrowFlip.inputsSchema.safeParse({ answers, endMs }).success;
    expect(bad([{ prompt: 30, atMs: 1, dir: "left" }])).toBe(false);
    expect(bad([{ prompt: 1.5, atMs: 1, dir: "left" }])).toBe(false);
    expect(bad([{ prompt: 0, atMs: 1, dir: "north" }])).toBe(false);
    expect(bad([{ prompt: 0, atMs: -1, dir: "left" }])).toBe(false);
    expect(bad([{ prompt: 0, atMs: 5, dir: "left" }, { prompt: 1, atMs: 5, dir: "up" }])).toBe(false);
    expect(bad(Array.from({ length: TOTAL_PROMPTS + 1 }, (_, i) => ({ prompt: 0, atMs: i + 1, dir: "left" })))).toBe(false);
    expect(bad([{ prompt: 0, atMs: 500, dir: "left" }], 400)).toBe(false);
    expect(bad([], 0)).toBe(true);
  });
});
