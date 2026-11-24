import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWANCE_MS,
  BANK_MS,
  COLOURS,
  LIMIT_MS,
  MISMATCHES,
  ROUNDS,
  ROUND_COUNTDOWN_MS,
  TIMEOUT_COST_MS,
  TOTAL_WORDS,
  WORDS_PER_ROUND,
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

// Explicit params: a 6 000 ms bank and five rounds of the same eight words.
const WORDS: InkWord[] = [
  { word: "red", ink: "red" },
  { word: "blue", ink: "yellow" },
  { word: "black", ink: "blue" },
  { word: "yellow", ink: "yellow" },
  { word: "red", ink: "black" },
  { word: "blue", ink: "blue" },
  { word: "yellow", ink: "red" },
  { word: "black", ink: "black" },
];
const params: InkParams = {
  bank: 6000,
  rounds: ALLOWANCE_MS.map((allowanceMs, k) => ({ allowanceMs, limitMs: LIMIT_MS[k], words: WORDS })),
};
/** A 300 ms bank, for the edge of what fits. */
const small: InkParams = { ...params, bank: 300 };
const wordOf = (w: number) => WORDS[w % WORDS_PER_ROUND];
const allowanceOf = (w: number) => ALLOWANCE_MS[Math.floor(w / WORDS_PER_ROUND)];
const wrongFor = (w: InkWord): Colour => (w.ink === "red" ? "blue" : "red");

/**
 * Answers words 0 to `reactions.length - 1` in order; `reactions[w]` is the ms after word w appeared,
 * and `wrong` lists the words answered wrongly. Each next word follows the gap (and a 3-2-1 at a
 * round's start), as the engine times them.
 */
function answer(reactions: number[], wrong: number[] = []) {
  const answers: InkAnswer[] = [];
  let appears = ROUND_COUNTDOWN_MS;
  reactions.forEach((reaction, w) => {
    const atMs = appears + reaction;
    answers.push({ word: w, atMs, colour: wrong.includes(w) ? wrongFor(wordOf(w)) : wordOf(w).ink });
    appears = atMs + WORD_GAP_MS + ((w + 1) % WORDS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
  });
  return { answers, endMs: answers.at(-1)?.atMs ?? 0 };
}
const fast = (n: number) => Array.from({ length: n }, () => 500);

describe("Ink params (T249)", () => {
  const seeds = Array.from({ length: 1000 }, (_, seed) => seed);

  it("is deterministic per seed", () => {
    expect(paramsFromSeed(42)).toEqual(paramsFromSeed(42));
    expect(paramsFromSeed(42)).not.toEqual(paramsFromSeed(43));
  });

  it("gives every seed the exact mismatches per round, the ladder's timings and no repeated ink", () => {
    for (const seed of seeds) {
      const { bank, rounds } = paramsFromSeed(seed);
      expect(bank).toBe(BANK_MS);
      expect(rounds).toHaveLength(ROUNDS);
      rounds.forEach((round, k) => {
        expect(round.words).toHaveLength(WORDS_PER_ROUND);
        expect(round.words.filter((w) => w.word !== w.ink)).toHaveLength(MISMATCHES[k]);
        expect(round.words.every((w) => COLOURS.includes(w.word) && COLOURS.includes(w.ink))).toBe(true);
        expect([round.allowanceMs, round.limitMs]).toEqual([ALLOWANCE_MS[k], LIMIT_MS[k]]);
      });
      const inks = rounds.flatMap((r) => r.words.map((w) => w.ink));
      expect(inks.every((c, i) => i === 0 || c !== inks[i - 1])).toBe(true);
    }
  });

  it("follows the proposed ladder, with four colours and no green", () => {
    expect([ROUNDS, WORDS_PER_ROUND]).toEqual([5, 8]);
    expect(COLOURS).toEqual(["red", "blue", "yellow", "black"]);
    expect(MISMATCHES).toEqual([2, 3, 4, 5, 6]);
    expect(LIMIT_MS).toEqual([2500, 2250, 2000, 1750, 1500]);
    expect(ALLOWANCE_MS).toEqual([1200, 1050, 950, 850, 800]);
  });

  it("puts the mismatches in different places across seeds", () => {
    const layouts = new Set(seeds.slice(0, 50).map((seed) => paramsFromSeed(seed).rounds[0].words.map((w) => (w.word === w.ink ? "=" : "x")).join("")));
    expect(layouts.size).toBeGreaterThan(10);
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG or the draw changes these)", (seed) => {
    const rounds = paramsFromSeed(seed).rounds.map((r) => r.words.map((w) => `${w.word}/${w.ink}`).join(" "));
    expect(rounds).toMatchSnapshot();
  });

  it("uses no Math.random, Date.now or DOM", () => {
    const source = readFileSync(new URL("./engine.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now|document\.|window\./);
  });
});

describe("Ink score (T249)", () => {
  it("costs only the slow part of a right answer and adds the wrong cost to a wrong one", () => {
    expect(answerCost(true, 1200, 1200)).toBe(0);
    expect(answerCost(true, 1500, 1200)).toBe(300);
    expect(answerCost(false, 900, 1200)).toBe(WRONG_COST_MS);
    expect(answerCost(false, 1300, 1200)).toBe(WRONG_COST_MS + 100);
  });

  it("scores 5 + 1 = 6 for all 40 words right within the allowance", () => {
    const inputs = answer(Array.from({ length: TOTAL_WORDS }, (_, w) => allowanceOf(w)));
    expect(ink.score(params, inputs)).toBe(6);
    expect(ink.finished(params, inputs)).toBe(true);
  });

  it("costs a wrong answer at the allowance exactly 1 000, scoring 5 + 5 000 / 6 000", () => {
    const inputs = answer(Array.from({ length: TOTAL_WORDS }, (_, w) => allowanceOf(w)), [2]);
    const state = play(params, inputs);
    expect(state.costs[2]).toBe(1000);
    expect(state.left).toBe(5000);
    expect(ink.score(params, inputs)).toBe(5.833);
  });

  it("costs a right answer 300 ms over the allowance 300", () => {
    expect(play(params, answer([1500])).costs).toEqual([300]);
  });

  it("survives a cost equal to what is left and ends the run 1 ms more", () => {
    const exact = play(small, answer([1500]));
    expect([exact.failed, exact.left, exact.wordsSurvived]).toEqual([false, 0, 1]);
    const over = play(small, answer([1501]));
    expect([over.failed, over.finished, over.roundsSurvived]).toEqual([true, true, 0]);
  });

  it("scores the whole rounds before a bust: 2 when the run ends in round 3", () => {
    // Words 16 to 23 are round 3; six wrong answers there spend the 6 000 bank, the seventh (word 22) busts it.
    const inputs = answer(fast(24), [16, 17, 18, 19, 20, 21, 22]);
    const state = play(params, inputs);
    expect([state.failed, state.wordsSurvived, state.roundsSurvived]).toEqual([true, 22, 2]);
    expect(ink.score(params, inputs)).toBe(2);
  });

  it("costs a missed word 1 500 and moves on to the next word after the gap", () => {
    const limit = ROUND_COUNTDOWN_MS + LIMIT_MS[0];
    const state = play(params, { answers: [], endMs: limit + 1 });
    expect(state.costs).toEqual([TIMEOUT_COST_MS]);
    expect(state.last).toEqual({ kind: "timeout", word: 0, atMs: limit, cost: TIMEOUT_COST_MS, survived: true });
    expect(state.appearsAt).toBe(limit + WORD_GAP_MS);
    // A miss is counted once its limit has passed, not at it.
    expect(play(params, { answers: [], endMs: limit }).costs).toEqual([]);
    // An answer after a miss is for the next word.
    const next = play(params, { answers: [{ word: 1, atMs: limit + WORD_GAP_MS + 300, colour: WORDS[1].ink }], endMs: limit + 1000 });
    expect(next.costs).toEqual([TIMEOUT_COST_MS, 0]);
  });

  it("takes an answer at exactly the limit, and ends a run of misses once they bust the bank", () => {
    const limit = ROUND_COUNTDOWN_MS + LIMIT_MS[0];
    const atLimit = play(params, { answers: [{ word: 0, atMs: limit, colour: WORDS[0].ink }], endMs: limit });
    expect(atLimit.last).toMatchObject({ kind: "answer", cost: LIMIT_MS[0] - ALLOWANCE_MS[0] });
    // Four misses cost 6 000, exactly the bank; the fifth busts it.
    const misses = play(params, { answers: [], endMs: 60_000 });
    expect(misses.costs).toEqual(Array.from({ length: 5 }, () => TIMEOUT_COST_MS));
    expect([misses.finished, misses.failed, misses.roundsSurvived]).toEqual([true, true, 0]);
  });

  it("ignores an answer before the word appeared, or for another word", () => {
    const early = { word: 0, atMs: ROUND_COUNTDOWN_MS - 1, colour: WORDS[0].ink };
    const otherWord = { word: 3, atMs: ROUND_COUNTDOWN_MS + 100, colour: WORDS[3].ink };
    const right = { word: 0, atMs: ROUND_COUNTDOWN_MS + 200, colour: WORDS[0].ink };
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

  it("reports the word on screen, its round, when it appears and its limit", () => {
    const state = play(params, answer(fast(8)));
    expect([state.word, state.round]).toEqual([8, 1]);
    const appears = ROUND_COUNTDOWN_MS + 8 * 500 + 8 * WORD_GAP_MS + ROUND_COUNTDOWN_MS;
    expect([state.appearsAt, state.deadline]).toEqual([appears, appears + LIMIT_MS[1]]);
    const over = play(params, answer(fast(TOTAL_WORDS)));
    expect([over.finished, over.word, over.appearsAt, over.deadline]).toEqual([true, TOTAL_WORDS - 1, null, null]);
  });

  it("stops at a bust and ignores answers after it", () => {
    expect(play(small, answer([1501, 500])).costs).toEqual([301]);
  });

  it("stays within 0 to ROUNDS + 1 and gives the same score to the same inputs", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const seeded = paramsFromSeed(seed);
      const answers: InkAnswer[] = [];
      let appears = ROUND_COUNTDOWN_MS;
      for (let w = 0; w < TOTAL_WORDS; w++) {
        const word = seeded.rounds[Math.floor(w / WORDS_PER_ROUND)].words[w % WORDS_PER_ROUND];
        const atMs = appears + 300 + ((seed * 37 + w * 101) % 900);
        answers.push({ word: w, atMs, colour: (seed + w) % 7 === 0 ? word.word : word.ink });
        appears = atMs + WORD_GAP_MS + ((w + 1) % WORDS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
      }
      const inputs = { answers, endMs: answers.at(-1)!.atMs };
      const score = ink.score(seeded, inputs);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(ROUNDS + 1);
      expect(ink.score(seeded, inputs)).toBe(score);
    }
  });
});

describe("Ink module (T249)", () => {
  it("is higher-better and ends at the run's end", () => {
    expect(ink.direction).toBe("higher-better");
    expect(ink.lastInputMs({ answers: [], endMs: 1234 }, params)).toBe(1234);
    expect(ink.finished(params, { answers: [], endMs: 0 })).toBe(false);
  });

  it("accepts a valid run and rejects bad answers", () => {
    expect(ink.inputsSchema.safeParse(answer(fast(3))).success).toBe(true);
    const bad = (answers: unknown[], endMs = 10_000) => ink.inputsSchema.safeParse({ answers, endMs }).success;
    expect(bad([{ word: TOTAL_WORDS, atMs: 1, colour: "red" }])).toBe(false);
    expect(bad([{ word: 1.5, atMs: 1, colour: "red" }])).toBe(false);
    expect(bad([{ word: 0, atMs: 1, colour: "green" }])).toBe(false);
    expect(bad([{ word: 0, atMs: -1, colour: "red" }])).toBe(false);
    expect(bad([{ word: 0, atMs: 5, colour: "red" }, { word: 1, atMs: 5, colour: "blue" }])).toBe(false);
    expect(bad(Array.from({ length: TOTAL_WORDS + 1 }, (_, i) => ({ word: 0, atMs: i + 1, colour: "red" })))).toBe(false);
    expect(bad([{ word: 0, atMs: 500, colour: "red" }], 400)).toBe(false);
    expect(bad([], 0)).toBe(true);
  });
});
