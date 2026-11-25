import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWANCE_MS,
  BANK_MS,
  COLOURS,
  DEFAULT_PASS_TARGET,
  LIMIT_MS,
  MISMATCHES_PER_STRETCH,
  RUN_COUNTDOWN_MS,
  STRETCH,
  TIMEOUT_COST_MS,
  WORDS,
  WORD_GAP_MS,
  WRONG_COST_MS,
  answerCost,
  ink,
  paramsFromSeed,
  play,
  type Colour,
  type InkAnswer,
  type InkParams,
  type InkWord,
} from "./engine";

// Explicit params: a 6 000 ms bank and the same eight words five times over.
const EIGHT: InkWord[] = [
  { word: "red", ink: "red" },
  { word: "blue", ink: "yellow" },
  { word: "black", ink: "blue" },
  { word: "yellow", ink: "yellow" },
  { word: "red", ink: "black" },
  { word: "blue", ink: "blue" },
  { word: "yellow", ink: "red" },
  { word: "black", ink: "black" },
];
const params: InkParams = { bank: 6000, words: Array.from({ length: WORDS }, (_, w) => EIGHT[w % 8]) };
/** A 300 ms bank, for the edge of what fits. */
const small: InkParams = { ...params, bank: 300 };
const wrongFor = (w: InkWord): Colour => (w.ink === "red" ? "blue" : "red");

/**
 * Answers words 0 to `reactions.length - 1` in order; `reactions[w]` is the ms after word w appeared,
 * and `wrong` lists the words answered wrongly. Each next word follows the gap, as the engine times them.
 */
function answer(reactions: number[], wrong: number[] = []) {
  const answers: InkAnswer[] = [];
  let appears = RUN_COUNTDOWN_MS;
  reactions.forEach((reaction, w) => {
    const atMs = appears + reaction;
    answers.push({ word: w, atMs, colour: wrong.includes(w) ? wrongFor(params.words[w]) : params.words[w].ink });
    appears = atMs + WORD_GAP_MS;
  });
  return { answers, endMs: answers.at(-1)?.atMs ?? 0 };
}
const fast = (n: number) => Array.from({ length: n }, () => 500);
const atAllowance = (n: number) => Array.from({ length: n }, () => ALLOWANCE_MS);

describe("Ink params (T254)", () => {
  const seeds = Array.from({ length: 1000 }, (_, seed) => seed);

  it("is deterministic per seed", () => {
    expect(paramsFromSeed(42)).toEqual(paramsFromSeed(42));
    expect(paramsFromSeed(42)).not.toEqual(paramsFromSeed(43));
  });

  it("gives every seed 40 words, the exact mismatches per stretch of 8 and no repeated ink", () => {
    for (const seed of seeds) {
      const { bank, words } = paramsFromSeed(seed);
      expect(bank).toBe(BANK_MS);
      expect(words).toHaveLength(WORDS);
      expect(words.every((w) => COLOURS.includes(w.word) && COLOURS.includes(w.ink))).toBe(true);
      MISMATCHES_PER_STRETCH.forEach((n, s) => {
        expect(words.slice(s * STRETCH, (s + 1) * STRETCH).filter((w) => w.word !== w.ink), `seed ${seed} stretch ${s}`).toHaveLength(n);
      });
      expect(words.filter((w) => w.word !== w.ink)).toHaveLength(29);
      expect(words.every((w, i) => i === 0 || w.ink !== words[i - 1].ink)).toBe(true);
    }
  });

  it("follows the proposed numbers: one run of 40, 50% to 87.5% mismatches, one allowance and limit, four colours and no green", () => {
    expect([WORDS, STRETCH]).toEqual([40, 8]);
    expect(MISMATCHES_PER_STRETCH).toEqual([4, 5, 6, 7, 7]);
    expect(MISMATCHES_PER_STRETCH.reduce((a, b) => a + b, 0)).toBe(29);
    expect([ALLOWANCE_MS, LIMIT_MS]).toEqual([1000, 2000]);
    expect(COLOURS).toEqual(["red", "blue", "yellow", "black"]);
    expect(DEFAULT_PASS_TARGET).toBe(40);
  });

  it("puts the mismatches in different places across seeds", () => {
    const layouts = new Set(seeds.slice(0, 50).map((seed) => paramsFromSeed(seed).words.slice(0, STRETCH).map((w) => (w.word === w.ink ? "=" : "x")).join("")));
    expect(layouts.size).toBeGreaterThan(10);
  });

  // Re-recorded for T254 (one run of 40 with the 4-5-6-7-7 ramp); the five-round goldens of T249 are superseded.
  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG or the draw changes these)", (seed) => {
    const words = paramsFromSeed(seed).words.map((w) => `${w.word}/${w.ink}`);
    const stretches = Array.from({ length: WORDS / STRETCH }, (_, s) => words.slice(s * STRETCH, (s + 1) * STRETCH).join(" "));
    expect(stretches).toMatchSnapshot();
  });

  it("uses no Math.random, Date.now or DOM", () => {
    const source = readFileSync(new URL("./engine.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now|document\.|window\./);
  });
});

describe("Ink score (T254)", () => {
  it("costs only the slow part of a right answer and adds the wrong cost to a wrong one", () => {
    expect(answerCost(true, ALLOWANCE_MS)).toBe(0);
    expect(answerCost(true, ALLOWANCE_MS + 300)).toBe(300);
    expect(answerCost(false, 900)).toBe(WRONG_COST_MS);
    expect(answerCost(false, ALLOWANCE_MS + 100)).toBe(WRONG_COST_MS + 100);
  });

  it("scores 40 + 1 = 41 for all 40 words right within the allowance", () => {
    const inputs = answer(atAllowance(WORDS));
    expect(ink.score(params, inputs)).toBe(41);
    expect(ink.finished(params, inputs)).toBe(true);
  });

  it("costs a wrong answer at the allowance exactly WRONG_COST_MS, scoring 40 + 5 000 / 6 000", () => {
    const inputs = answer(atAllowance(WORDS), [2]);
    const state = play(params, inputs);
    expect(state.costs[2]).toBe(WRONG_COST_MS);
    expect(state.left).toBe(6000 - WRONG_COST_MS);
    expect(ink.score(params, inputs)).toBe(40.833);
  });

  it("costs a right answer 300 ms over the allowance 300", () => {
    expect(play(params, answer([ALLOWANCE_MS + 300])).costs).toEqual([300]);
  });

  it("survives a cost equal to what is left and ends the run 1 ms more", () => {
    const exact = play(small, answer([ALLOWANCE_MS + 300]));
    expect([exact.failed, exact.left, exact.wordsSurvived]).toEqual([false, 0, 1]);
    const over = play(small, answer([ALLOWANCE_MS + 301]));
    expect([over.failed, over.finished, over.wordsSurvived]).toEqual([true, true, 0]);
  });

  it("scores the whole words before a bust: 12 when word 13 busts the bank", () => {
    // Six wrong answers on words 6 to 11 spend the 6 000 bank; the seventh (word 12) busts it.
    const inputs = answer(fast(14), [6, 7, 8, 9, 10, 11, 12]);
    const state = play(params, inputs);
    expect([state.failed, state.wordsSurvived, state.left]).toEqual([true, 12, 0]);
    expect(ink.score(params, inputs)).toBe(12);
  });

  it("costs a missed word TIMEOUT_COST_MS and moves on to the next word after the gap", () => {
    const limit = RUN_COUNTDOWN_MS + LIMIT_MS;
    const state = play(params, { answers: [], endMs: limit + 1 });
    expect(state.costs).toEqual([TIMEOUT_COST_MS]);
    expect(state.last).toEqual({ kind: "timeout", word: 0, atMs: limit, cost: TIMEOUT_COST_MS, survived: true });
    expect(state.appearsAt).toBe(limit + WORD_GAP_MS);
    // A miss is counted once its limit has passed, not at it.
    expect(play(params, { answers: [], endMs: limit }).costs).toEqual([]);
    // An answer after a miss is for the next word.
    const next = play(params, { answers: [{ word: 1, atMs: limit + WORD_GAP_MS + 300, colour: EIGHT[1].ink }], endMs: limit + 1000 });
    expect(next.costs).toEqual([TIMEOUT_COST_MS, 0]);
  });

  it("takes an answer at exactly the limit, and ends a run of misses once they bust the bank", () => {
    const limit = RUN_COUNTDOWN_MS + LIMIT_MS;
    const atLimit = play(params, { answers: [{ word: 0, atMs: limit, colour: EIGHT[0].ink }], endMs: limit });
    expect(atLimit.last).toMatchObject({ kind: "answer", cost: LIMIT_MS - ALLOWANCE_MS });
    // Four misses cost 6 000, exactly the bank; the fifth busts it.
    const misses = play(params, { answers: [], endMs: 60_000 });
    expect(misses.costs).toEqual(Array.from({ length: 5 }, () => TIMEOUT_COST_MS));
    expect([misses.finished, misses.failed, misses.wordsSurvived]).toEqual([true, true, 4]);
  });

  it("ignores an answer before the word appeared, or for another word", () => {
    const early = { word: 0, atMs: RUN_COUNTDOWN_MS - 1, colour: EIGHT[0].ink };
    const otherWord = { word: 3, atMs: RUN_COUNTDOWN_MS + 100, colour: EIGHT[3].ink };
    const right = { word: 0, atMs: RUN_COUNTDOWN_MS + 200, colour: EIGHT[0].ink };
    const state = play(params, { answers: [early, otherWord, right], endMs: right.atMs });
    expect(state.costs).toEqual([0]);
    expect(state.last).toMatchObject({ kind: "answer", word: 0, atMs: right.atMs, correct: true });
  });

  it("counts the word's own name as wrong when the ink differs", () => {
    // Word 1 reads BLUE in yellow ink.
    const inputs = answer([500]);
    inputs.answers.push({ word: 1, atMs: inputs.endMs + WORD_GAP_MS + 500, colour: "blue" });
    inputs.endMs = inputs.answers[1].atMs;
    const state = play(params, inputs);
    expect(state.costs).toEqual([0, WRONG_COST_MS]);
    expect(state.last).toMatchObject({ correct: false, colour: "blue" });
  });

  it("brings every word up one gap after the last, with no 3-2-1 after the first", () => {
    const state = play(params, answer(fast(8)));
    expect(state.word).toBe(8);
    const appears = RUN_COUNTDOWN_MS + 8 * 500 + 8 * WORD_GAP_MS;
    expect([state.appearsAt, state.deadline]).toEqual([appears, appears + LIMIT_MS]);
    expect(play(params, { answers: [], endMs: 0 })).toMatchObject({ word: 0, appearsAt: RUN_COUNTDOWN_MS, deadline: RUN_COUNTDOWN_MS + LIMIT_MS, last: null });
    const over = play(params, answer(fast(WORDS)));
    expect([over.finished, over.word, over.appearsAt, over.deadline]).toEqual([true, WORDS - 1, null, null]);
  });

  it("stops at a bust and ignores answers after it", () => {
    expect(play(small, answer([ALLOWANCE_MS + 301, 500])).costs).toEqual([301]);
  });

  it("stays within 0 to 41 and gives the same score to the same inputs", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const seeded = paramsFromSeed(seed);
      const answers: InkAnswer[] = [];
      let appears = RUN_COUNTDOWN_MS;
      seeded.words.forEach((word, w) => {
        const atMs = appears + 300 + ((seed * 37 + w * 101) % 1100);
        answers.push({ word: w, atMs, colour: (seed + w) % 7 === 0 ? word.word : word.ink });
        appears = atMs + WORD_GAP_MS;
      });
      const inputs = { answers, endMs: answers.at(-1)!.atMs };
      const score = ink.score(seeded, inputs);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(WORDS + 1);
      expect(ink.score(seeded, inputs)).toBe(score);
    }
  });
});

describe("Ink module (T254)", () => {
  it("is higher-better and ends at the run's end", () => {
    expect(ink.direction).toBe("higher-better");
    expect(ink.lastInputMs({ answers: [], endMs: 1234 }, params)).toBe(1234);
    expect(ink.finished(params, { answers: [], endMs: 0 })).toBe(false);
  });

  it("accepts a valid run and rejects bad answers", () => {
    expect(ink.inputsSchema.safeParse(answer(fast(3))).success).toBe(true);
    expect(ink.inputsSchema.safeParse(answer(fast(WORDS))).success).toBe(true);
    const bad = (answers: unknown[], endMs = 10_000) => ink.inputsSchema.safeParse({ answers, endMs }).success;
    expect(bad([{ word: WORDS, atMs: 1, colour: "red" }])).toBe(false);
    expect(bad([{ word: 1.5, atMs: 1, colour: "red" }])).toBe(false);
    expect(bad([{ word: 0, atMs: 1, colour: "green" }])).toBe(false);
    expect(bad([{ word: 0, atMs: -1, colour: "red" }])).toBe(false);
    expect(bad([{ word: 0, atMs: 5, colour: "red" }, { word: 1, atMs: 5, colour: "blue" }])).toBe(false);
    expect(bad(Array.from({ length: WORDS + 1 }, (_, i) => ({ word: 0, atMs: i + 1, colour: "red" })))).toBe(false);
    expect(bad([{ word: 0, atMs: 500, colour: "red" }], 400)).toBe(false);
    expect(bad([{ word: 0, atMs: Number.NaN, colour: "red" }])).toBe(false);
    expect(bad([], Number.POSITIVE_INFINITY)).toBe(false);
    expect(bad([], 0)).toBe(true);
  });
});
