import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { MIN_SPACING } from "./engine";
import {
  DOT_COUNT_RANGES,
  FLASH_MS_RANGE,
  LIVES,
  MAX_ROUNDS,
  TOLERANCE_FRACTION,
  flashLadder,
  layoutFor,
  paramsFromSeed,
  play,
  tolerance,
  type FlashLadderParams,
} from "./flashLadder";

/** Explicit params from the backlog's worked examples: dot counts 10, 14 and 18. */
const three: FlashLadderParams = { layoutSeed: 7, levels: [10, 14, 18].map((dotCount) => ({ dotCount, flashMs: 1500 })) };

/** Answers one second apart, from the counts. */
const answers = (...counts: number[]) => ({ answers: counts.map((count, i) => ({ count, atMs: 1000 * (i + 1) })) });

describe("Flash Ladder params", () => {
  it("documents the placeholders: 3 lives, 10 levels, a 10% tolerance", () => {
    expect(LIVES).toBe(3);
    expect(MAX_ROUNDS).toBe(10);
    expect(TOLERANCE_FRACTION).toBe(0.1);
    expect(DOT_COUNT_RANGES).toHaveLength(MAX_ROUNDS);
  });

  it("give every seed 0 to 999 rising counts and shortening flashes inside the documented ranges", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const { levels } = paramsFromSeed(seed);
      expect(levels).toHaveLength(MAX_ROUNDS);
      levels.forEach((level, i) => {
        expect(level.dotCount).toBeGreaterThanOrEqual(DOT_COUNT_RANGES[i].min);
        expect(level.dotCount).toBeLessThanOrEqual(DOT_COUNT_RANGES[i].max);
        expect(level.flashMs).toBeGreaterThanOrEqual(FLASH_MS_RANGE.min);
        expect(level.flashMs).toBeLessThanOrEqual(FLASH_MS_RANGE.max);
        if (i > 0) {
          expect(level.dotCount).toBeGreaterThan(levels[i - 1].dotCount);
          expect(level.flashMs).toBeLessThan(levels[i - 1].flashMs);
        }
      });
    }
  });

  it("are the same for the same seed", () => {
    for (let seed = 0; seed < 1000; seed++) expect(paramsFromSeed(seed)).toEqual(paramsFromSeed(seed));
  });

  it.each([
    [0, [8, 11, 14, 17, 21, 24, 27, 30, 33, 36]],
    [1, [9, 11, 15, 19, 22, 23, 27, 31, 33, 37]],
    [4_294_967_295, [10, 11, 16, 19, 22, 24, 28, 30, 32, 37]],
  ])("golden: seed %i gives the dot counts %j (changing the PRNG or the ranges changes these)", (seed, counts) => {
    expect(paramsFromSeed(seed).levels.map((level) => level.dotCount)).toEqual(counts);
  });
});

describe("Flash Ladder layouts", () => {
  it("place each level's dots inside the square, MIN_SPACING apart, for seeds 0 to 19 and three tries", () => {
    for (let seed = 0; seed < 20; seed++) {
      const params = paramsFromSeed(seed);
      for (let level = 0; level < MAX_ROUNDS; level++) {
        for (let tryIndex = 0; tryIndex < LIVES; tryIndex++) {
          const dots = layoutFor(params, level, tryIndex);
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
    }
  });

  it("are the same for the same level and try, and new for a retry or another level", () => {
    const params = paramsFromSeed(42);
    expect(layoutFor(params, 2, 1)).toEqual(layoutFor(params, 2, 1));
    expect(layoutFor(params, 2, 1)).not.toEqual(layoutFor(params, 2, 0));
    expect(layoutFor(params, 3, 0)).not.toEqual(layoutFor({ ...params, layoutSeed: params.layoutSeed + 1 }, 3, 0));
  });
});

describe("Flash Ladder score", () => {
  it.each([
    [10, 1],
    [19, 1],
    [20, 2],
    [29, 2],
    [37, 3],
  ])("allows %i dots a tolerance of %i", (dotCount, allowed) => {
    expect(tolerance(dotCount)).toBe(allowed);
  });

  it.each([
    ["10, 16, 14, 30, 25: lives run out on level 3", [10, 16, 14, 30, 25], 2],
    ["10, 14, 19: every level, no life lost", [10, 14, 19], 4],
    ["9, 14, 18: 9 is within the tolerance of 1", [9, 14, 18], 4],
    ["one miss on the way: 3 levels and 2 lives left", [10, 12, 14, 18], 3.667],
    ["three misses on level 1", [5, 5, 5], 0],
  ])("%s", (_name, counts, score) => {
    expect(flashLadder.score(three, answers(...counts))).toBe(score);
  });

  it("ignores answers after the run has ended", () => {
    expect(flashLadder.score(three, answers(5, 5, 5, 10, 14, 18))).toBe(0);
    expect(flashLadder.score(three, answers(10, 14, 18, 99))).toBe(4);
  });

  it.each([
    // Seed 0's counts are all within 1 of these; seeds 1 and the last start at 9 and 10 dots.
    [0, 11],
    [1, 1],
    [4_294_967_295, 1],
  ])("golden: seed %i with fixed answers scores %d", (seed, score) => {
    const fixed = [7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 34, 34, 34];
    expect(flashLadder.score(paramsFromSeed(seed), answers(...fixed))).toBe(score);
  });

  it("gives the same score for the same answers, between 0 and the number of levels plus one (property)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const params = paramsFromSeed(seed);
      const counts = params.levels.map((level, i) => level.dotCount + ((seed + i) % 5) - 2);
      const first = flashLadder.score(params, answers(...counts));
      expect(flashLadder.score(params, answers(...counts))).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(MAX_ROUNDS + 1);
    }
  });

  it("is higher-better", () => {
    expect(flashLadder.direction).toBe("higher-better");
  });
});

describe("Flash Ladder balance", () => {
  it("lets a decent estimator (off by up to 16% either way) clear about 6 levels on average", () => {
    let total = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const params = paramsFromSeed(seed);
      const rng = createRng(seed + 1_000_000);
      const run = { answers: [] as { count: number; atMs: number }[] };
      while (!flashLadder.finished(params, run)) {
        const { dotCount } = params.levels[play(params, run).cleared];
        run.answers.push({ count: Math.round(dotCount * (1 + (rng.next() * 2 - 1) * 0.16)), atMs: 1000 * (run.answers.length + 1) });
      }
      total += play(params, run).cleared;
    }
    const average = total / 1000;
    expect(average).toBeGreaterThanOrEqual(5.5);
    expect(average).toBeLessThanOrEqual(6.5);
  });
});

describe("Flash Ladder play", () => {
  it("tracks the level, lives and the retry for the game to show", () => {
    expect(play(three, answers())).toEqual({ cleared: 0, lives: 3, tryIndex: 0, finished: false });
    expect(play(three, answers(10, 16))).toEqual({ cleared: 1, lives: 2, tryIndex: 1, finished: false });
    expect(play(three, answers(10, 16, 14))).toEqual({ cleared: 2, lives: 2, tryIndex: 0, finished: false });
  });
});

describe("Flash Ladder inputs", () => {
  it("accept whole counts 0 to 999 at rising times", () => {
    expect(flashLadder.inputsSchema.safeParse(answers(0, 999)).success).toBe(true);
    expect(flashLadder.inputsSchema.safeParse({ answers: [] }).success).toBe(true);
    expect(flashLadder.inputsSchema.safeParse(answers(...Array<number>(MAX_ROUNDS + LIVES).fill(1))).success).toBe(true);
  });

  it.each([
    ["a negative count", answers(-1)],
    ["a count over 999", answers(1000)],
    ["a fractional count", answers(1.5)],
    ["a negative time", { answers: [{ count: 1, atMs: -1 }] }],
    ["times that do not rise", { answers: [{ count: 1, atMs: 500 }, { count: 2, atMs: 500 }] }],
    ["more answers than levels plus lives", answers(...Array<number>(MAX_ROUNDS + LIVES + 1).fill(1))],
    ["a single count", { count: 3 }],
  ])("reject %s", (_name, inputs) => {
    expect(flashLadder.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("are finished once lives run out or the last level is cleared", () => {
    expect(flashLadder.finished(three, answers())).toBe(false);
    expect(flashLadder.finished(three, answers(10, 16))).toBe(false);
    expect(flashLadder.finished(three, answers(10, 16, 14, 30, 25))).toBe(true);
    expect(flashLadder.finished(three, answers(10, 14, 18))).toBe(true);
  });

  it("time the latest input at the last answer", () => {
    expect(flashLadder.lastInputMs(answers(), three)).toBe(0);
    expect(flashLadder.lastInputMs(answers(10, 16, 14), three)).toBe(3000);
  });
});
