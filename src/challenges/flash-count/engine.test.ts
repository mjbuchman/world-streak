import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { MIN_SPACING } from "./dots";
import {
  BANK,
  DOT_COUNT_MAX,
  DOT_COUNT_MIN,
  FLASH_MS_RANGE,
  ROUNDS,
  flashCount,
  layoutFor,
  paramsFromSeed,
  play,
  roundCost,
  type FlashCountParams,
} from "./engine";

/** Explicit params from the backlog's worked examples: dot counts 10, 14, 18, 22 and 26, a bank of 10. */
const five: FlashCountParams = { layoutSeed: 7, bank: 10, levels: [10, 14, 18, 22, 26].map((dotCount) => ({ dotCount, flashMs: 1500 })) };

/** Answers one second apart, from the counts. */
const answers = (...counts: number[]) => ({ answers: counts.map((count, i) => ({ count, atMs: 1000 * (i + 1) })) });

describe("Swift Sum params", () => {
  it("documents the values: 5 rounds, a fresh count of 10 to 30 dots every round (owner, T205)", () => {
    expect(ROUNDS).toBe(5);
    expect(DOT_COUNT_MIN).toBe(10);
    expect(DOT_COUNT_MAX).toBe(30);
    expect(FLASH_MS_RANGE).toEqual({ min: 1400, max: 1800 });
  });

  it("give every seed 0 to 999 counts of 10 to 30, a flash 100 ms shorter each round, and the bank", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const { levels, bank } = paramsFromSeed(seed);
      expect(bank).toBe(BANK);
      expect(levels).toHaveLength(ROUNDS);
      levels.forEach((level, i) => {
        expect(level.dotCount).toBeGreaterThanOrEqual(10);
        expect(level.dotCount).toBeLessThanOrEqual(30);
        expect(level.flashMs).toBe(1800 - 100 * i);
      });
    }
  });

  it("draw every count from 10 to 30 in every round, with no rise from round 1 to round 5", () => {
    const runs = Array.from({ length: 1000 }, (_, seed) => paramsFromSeed(seed).levels.map((level) => level.dotCount));
    for (let i = 0; i < ROUNDS; i++) expect(new Set(runs.map((counts) => counts[i])).size).toBe(21);
    const mean = (i: number) => runs.reduce((sum, counts) => sum + counts[i], 0) / runs.length;
    expect(Math.abs(mean(ROUNDS - 1) - mean(0))).toBeLessThan(1.5);
  });

  it("are the same for the same seed", () => {
    for (let seed = 0; seed < 1000; seed++) expect(paramsFromSeed(seed)).toEqual(paramsFromSeed(seed));
  });

  it("differ from player to player: every round's count varies, and almost no two seeds share all five", () => {
    const runs = Array.from({ length: 1000 }, (_, seed) => paramsFromSeed(seed).levels.map((level) => level.dotCount));
    for (let i = 0; i < ROUNDS; i++) expect(new Set(runs.map((counts) => counts[i])).size).toBeGreaterThanOrEqual(5);
    const seen = new Map<string, number>();
    for (const counts of runs) seen.set(counts.join(), (seen.get(counts.join()) ?? 0) + 1);
    const samePairs = [...seen.values()].reduce((sum, n) => sum + (n * (n - 1)) / 2, 0);
    expect(samePairs / ((1000 * 999) / 2)).toBeLessThan(0.001);
  });

  it.each([
    [0, [15, 10, 14, 13, 19]],
    [1, [23, 10, 21, 30, 30]],
    [4_294_967_295, [28, 13, 25, 29, 27]],
  ])("golden: seed %i gives the dot counts %j (changing the PRNG or the range changes these)", (seed, counts) => {
    expect(paramsFromSeed(seed).levels.map((level) => level.dotCount)).toEqual(counts);
  });
});

describe("Swift Sum layouts", () => {
  it("place each round's dots inside the square, MIN_SPACING apart, for seeds 0 to 49", () => {
    for (let seed = 0; seed < 50; seed++) {
      const params = paramsFromSeed(seed);
      for (let level = 0; level < ROUNDS; level++) {
        const dots = layoutFor(params, level);
        expect(dots).toHaveLength(params.levels[level].dotCount);
        for (const dot of dots) {
          expect(dot.x - dot.r).toBeGreaterThanOrEqual(0);
          expect(dot.x + dot.r).toBeLessThanOrEqual(1);
          expect(dot.y - dot.r).toBeGreaterThanOrEqual(0);
          expect(dot.y + dot.r).toBeLessThanOrEqual(1);
        }
        dots.forEach((a, i) => dots.slice(i + 1).forEach((b) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(MIN_SPACING)));
      }
    }
  });

  it("are the same for the same round, and differ between players and between rounds", () => {
    const params = paramsFromSeed(42);
    expect(layoutFor(params, 2)).toEqual(layoutFor(params, 2));
    expect(layoutFor(params, 3)).not.toEqual(layoutFor({ ...params, layoutSeed: params.layoutSeed + 1 }, 3));
    // Two rounds with the same count still get their own layouts.
    const twins = { layoutSeed: 5, bank: 10, levels: [{ dotCount: 12, flashMs: 1500 }, { dotCount: 12, flashMs: 1400 }] };
    expect(layoutFor(twins, 0)).not.toEqual(layoutFor(twins, 1));
  });
});

describe("Swift Sum score", () => {
  it("costs one dot of the bank for every dot missed or counted too many", () => {
    expect(roundCost(10, 10)).toBe(0);
    expect(roundCost(10, 7)).toBe(3);
    expect(roundCost(10, 13)).toBe(3);
  });

  it.each([
    ["10, 14, 18, 22, 26: every count right, the bank full", [10, 14, 18, 22, 26], 6],
    ["9, 15, 17, 23, 25: off by one each round", [9, 15, 17, 23, 25], 5.5],
    ["4, 14, 18, 22, 26: off by 6 once", [4, 14, 18, 22, 26], 5.4],
    ["0, 14, 18, 22, 26: off by exactly the bank still survives", [0, 14, 18, 22, 26], 5],
    ["30 first: off by 20 busts the bank", [30], 0],
    ["off by 4, 3, then 4: round 3 busts the bank", [6, 17, 22], 2],
    ["no answers", [], 1],
  ])("%s", (_name, counts, score) => {
    expect(flashCount.score(five, answers(...counts))).toBe(score);
  });

  it("scores counts that jump up and down the same way (T205: 12, 25, 18, 30, 21)", () => {
    const jumps = { ...five, levels: [12, 25, 18, 30, 21].map((dotCount) => ({ dotCount, flashMs: 1500 })) };
    expect(flashCount.score(jumps, answers(12, 25, 18, 30, 21))).toBe(6);
    expect(flashCount.score(jumps, answers(12, 24, 18, 29, 21))).toBe(5.8);
  });

  it("ignores answers after the run has ended", () => {
    expect(flashCount.score(five, answers(30, 14, 18))).toBe(0);
    expect(flashCount.score(five, answers(10, 14, 18, 22, 26, 99))).toBe(6);
  });

  it.each([
    [0, 5.8],
    [1, 2],
    [4_294_967_295, 0],
  ])("golden: seed %i with fixed answers scores %d", (seed, score) => {
    expect(flashCount.score(paramsFromSeed(seed), answers(15, 10, 15, 13, 20))).toBe(score);
  });

  it("gives the same score for the same answers, between 0 and the rounds plus one (property)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const params = paramsFromSeed(seed);
      const counts = params.levels.map((level, i) => level.dotCount + ((seed + i) % 7) - 3);
      const first = flashCount.score(params, answers(...counts));
      expect(flashCount.score(params, answers(...counts))).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(ROUNDS + 1);
    }
  });

  it("is higher-better", () => {
    expect(flashCount.direction).toBe("higher-better");
  });
});

describe("Swift Sum balance", () => {
  it("lets an estimator with a normal 15% error survive all five rounds 25% to 60% of the time", () => {
    let survivedAll = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const params = paramsFromSeed(seed);
      const rng = createRng(seed + 1_000_000);
      // Box-Muller: a normal error from two uniform draws.
      const normal = () => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
      const run = answers(...params.levels.map(({ dotCount }) => Math.max(0, Math.round(dotCount * (1 + 0.15 * normal())))));
      if (play(params, run).survived === ROUNDS) survivedAll++;
    }
    // Measured with 10 to 30 dots a round and a 10 dot bank (T205): 41%, so the bank stays at 10.
    expect(survivedAll / 1000).toBeGreaterThanOrEqual(0.25);
    expect(survivedAll / 1000).toBeLessThanOrEqual(0.6);
  });
});

describe("Swift Sum play", () => {
  it("tracks the rounds survived, the bank left and a bust", () => {
    expect(play(five, answers())).toEqual({ survived: 0, left: 10, failed: false });
    expect(play(five, answers(8, 15))).toEqual({ survived: 2, left: 7, failed: false });
    expect(play(five, answers(8, 15, 10))).toEqual({ survived: 2, left: 0, failed: true });
  });
});

describe("Swift Sum inputs", () => {
  it("accept whole counts 0 to 999 at rising times, up to one answer a round", () => {
    expect(flashCount.inputsSchema.safeParse(answers(0, 999)).success).toBe(true);
    expect(flashCount.inputsSchema.safeParse({ answers: [] }).success).toBe(true);
    expect(flashCount.inputsSchema.safeParse(answers(...Array<number>(ROUNDS).fill(1))).success).toBe(true);
  });

  it.each([
    ["a negative count", answers(-1)],
    ["a count over 999", answers(1000)],
    ["a fractional count", answers(1.5)],
    ["a negative time", { answers: [{ count: 1, atMs: -1 }] }],
    ["times that do not rise", { answers: [{ count: 1, atMs: 500 }, { count: 2, atMs: 500 }] }],
    ["more answers than rounds", answers(...Array<number>(ROUNDS + 1).fill(1))],
    ["a single count", { count: 3 }],
  ])("reject %s", (_name, inputs) => {
    expect(flashCount.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("are finished once the bank is bust or all five rounds are answered", () => {
    expect(flashCount.finished(five, answers())).toBe(false);
    expect(flashCount.finished(five, answers(10, 14, 18, 22))).toBe(false);
    expect(flashCount.finished(five, answers(30))).toBe(true);
    expect(flashCount.finished(five, answers(10, 14, 18, 22, 26))).toBe(true);
  });

  // Answers are timed from the run's start, so the last one already includes every 3-2-1, flash and reveal.
  it("time the latest input at the last answer", () => {
    expect(flashCount.lastInputMs(answers(), five)).toBe(0);
    expect(flashCount.lastInputMs(answers(10, 14, 18), five)).toBe(3000);
  });
});
