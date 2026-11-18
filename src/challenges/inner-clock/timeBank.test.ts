import { describe, expect, it } from "vitest";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { createRng } from "../shared/prng";
import {
  BUDGET_MS,
  REVEAL_MS,
  ROUNDS,
  ROUND_COUNTDOWN_MS,
  ROUND_GAP_MS,
  TARGET_RANGES_MS,
  paramsFromSeed,
  play,
  roundErrorMs,
  timeBank,
  type TimeBankParams,
} from "./timeBank";

/** Explicit params from the backlog's worked examples: a 10 s bank. */
function withTargets(...targetsMs: number[]): TimeBankParams {
  return { budgetMs: 10_000, rounds: targetsMs.map((targetMs) => ({ targetMs, revealMs: REVEAL_MS, timeoutMs: targetMs + 10_000 })) };
}

const four = withTargets(15_000, 18_000, 21_000, 24_000);

describe("Time Bank params", () => {
  it("documents the placeholders: a 10 s bank, 4 rounds, a 2 s clock, 15 to 25 s targets", () => {
    expect(BUDGET_MS).toBe(10_000);
    expect(ROUNDS).toBe(4);
    expect(REVEAL_MS).toBe(2000);
    expect(ROUND_COUNTDOWN_MS).toBe(RUN_COUNTDOWN_MS);
    expect(TARGET_RANGES_MS).toEqual([
      { min: 15_000, max: 17_400 },
      { min: 17_500, max: 19_900 },
      { min: 20_000, max: 22_400 },
      { min: 22_500, max: 24_900 },
    ]);
  });

  it("give every seed 0 to 999 rising targets on a 100 ms step inside their ranges, and a 2 s clock", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const params = paramsFromSeed(seed);
      expect(params.budgetMs).toBe(BUDGET_MS);
      expect(params.rounds).toHaveLength(ROUNDS);
      params.rounds.forEach((round, i) => {
        expect(round.targetMs % 100).toBe(0);
        expect(round.targetMs).toBeGreaterThanOrEqual(TARGET_RANGES_MS[i].min);
        expect(round.targetMs).toBeLessThanOrEqual(TARGET_RANGES_MS[i].max);
        expect(round.revealMs).toBe(2000);
        expect(round.timeoutMs).toBe(round.targetMs + BUDGET_MS);
        if (i > 0) expect(round.targetMs).toBeGreaterThan(params.rounds[i - 1].targetMs);
      });
    }
  });

  it("are the same for the same seed", () => {
    for (let seed = 0; seed < 1000; seed++) expect(paramsFromSeed(seed)).toEqual(paramsFromSeed(seed));
  });

  it("differ between players: over 1,000 seeds each round's target takes at least 20 values", () => {
    const seen = TARGET_RANGES_MS.map(() => new Set<number>());
    for (let seed = 0; seed < 1000; seed++) paramsFromSeed(seed).rounds.forEach((round, i) => seen[i].add(round.targetMs));
    for (const values of seen) expect(values.size).toBeGreaterThanOrEqual(20);
  });
});

describe("Time Bank score", () => {
  it.each([
    ["errors 500, 0, 0, 0: four rounds and 0.95 of the bank", [15_500, 18_000, 21_000, 24_000], 4.95],
    ["errors 2,000, 0, 7,000, 0: four rounds and 0.1 left", [17_000, 18_000, 28_000, 24_000], 4.1],
    ["an error of exactly the bank in round 1 survives with nothing left", [25_000, 18_000, 21_000, 24_000], 4],
    ["an error past the bank in round 1 busts it", [26_000], 0],
    ["no tap in round 1", [null], 0],
    ["a good round, then no tap", [15_000, null], 1],
  ])("%s", (_name, tapsMs, score) => {
    expect(timeBank.score(four, { tapsMs })).toBe(score);
  });

  it("makes a missing or late tap cost more than the whole bank, and a tap at the timeout itself", () => {
    const round = four.rounds[0];
    expect(roundErrorMs(round, null, 10_000)).toBe(10_001);
    expect(roundErrorMs(round, 25_000.5, 10_000)).toBe(10_001);
    expect(roundErrorMs(round, 25_000, 10_000)).toBe(10_000);
    expect(roundErrorMs(round, 14_000, 10_000)).toBe(1000);
  });

  it("rounds each error to the millisecond and the score to 3 decimals", () => {
    // Error 1,000.4 ms rounds to 1,000: 9,000 of 10,000 left.
    expect(play(withTargets(15_000), { tapsMs: [16_000.4] })).toEqual({ survived: 1, left: 9000, failed: false });
    expect(timeBank.score(withTargets(15_000), { tapsMs: [16_000.4] })).toBe(1.9);
  });

  it("ignores taps after the round that emptied the bank, and taps beyond the rounds", () => {
    expect(timeBank.score(four, { tapsMs: [null, 18_000, 21_000] })).toBe(0);
    expect(play(withTargets(15_000), { tapsMs: [15_000, 1] })).toEqual({ survived: 1, left: 10_000, failed: false });
  });

  it.each([
    [0, 4.71],
    [1, 4.65],
    [4_294_967_295, 4.59],
  ])("golden: seed %i with fixed taps scores %d (changing the PRNG or the ranges changes these)", (seed, score) => {
    const tapsMs = [16_000, 18_800, 21_000, 23_500];
    expect(timeBank.score(paramsFromSeed(seed), { tapsMs })).toBe(score);
  });

  it("gives the same score for the same taps, between 0 and the number of rounds plus one (property)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const params = paramsFromSeed(seed);
      const tapsMs = params.rounds.map((round, i) => round.targetMs + ((seed * 37 + i * 211) % 6000) - 3000);
      const first = timeBank.score(params, { tapsMs });
      expect(timeBank.score(params, { tapsMs })).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(ROUNDS + 1);
    }
  });

  it("is higher-better", () => {
    expect(timeBank.direction).toBe("higher-better");
  });
});

describe("Time Bank balance", () => {
  /**
   * A simulated player whose error is roughly normal with a spread (standard deviation) of 15% of
   * the interval, about 3 s on 20 s: the spread people show when counting seconds this long.
   */
  function survivesAll(seed: number): boolean {
    const params = paramsFromSeed(seed);
    const rng = createRng(seed + 1_000_000);
    const tapsMs = params.rounds.map((round) => {
      const normalish = (rng.next() + rng.next() + rng.next() - 1.5) * 2;
      return Math.max(0, Math.round(round.targetMs * (1 + 0.15 * normalish)));
    });
    return timeBank.score(params, { tapsMs }) >= ROUNDS;
  }

  it("lets that player survive all four rounds 30% to 70% of the time", () => {
    let survived = 0;
    for (let seed = 0; seed < 1000; seed++) if (survivesAll(seed)) survived++;
    expect(survived / 1000).toBeGreaterThanOrEqual(0.3);
    expect(survived / 1000).toBeLessThanOrEqual(0.7);
  });
});

describe("Time Bank inputs", () => {
  it("accept one tap or null per round played", () => {
    expect(timeBank.inputsSchema.safeParse({ tapsMs: [3200.5, null, 0] }).success).toBe(true);
    expect(timeBank.inputsSchema.safeParse({ tapsMs: [] }).success).toBe(true);
    expect(timeBank.inputsSchema.safeParse({ tapsMs: Array<number>(ROUNDS).fill(1) }).success).toBe(true);
  });

  it.each([
    ["a negative tap", { tapsMs: [-1] }],
    ["an infinite tap", { tapsMs: [Infinity] }],
    ["NaN", { tapsMs: [NaN] }],
    ["a text tap", { tapsMs: ["3000"] }],
    ["more taps than rounds", { tapsMs: Array<number>(ROUNDS + 1).fill(1) }],
    ["no taps field", {}],
    ["a single tap", { tapMs: 3000 }],
  ])("reject %s", (_name, inputs) => {
    expect(timeBank.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("are finished once a round empties the bank or every round has a tap", () => {
    expect(timeBank.finished(four, { tapsMs: [] })).toBe(false);
    expect(timeBank.finished(four, { tapsMs: [15_000, 18_000, 21_000] })).toBe(false);
    expect(timeBank.finished(four, { tapsMs: [15_000, 18_000, 21_000, 24_000] })).toBe(true);
    expect(timeBank.finished(four, { tapsMs: [null] })).toBe(true);
    expect(timeBank.finished(four, { tapsMs: [26_000] })).toBe(true);
    // An exactly empty bank still leaves the next round to play.
    expect(timeBank.finished(four, { tapsMs: [25_000] })).toBe(false);
  });

  it("time the latest tap from the run start: every tap, plus the gap and the 3-2-1 before each later round", () => {
    const between = ROUND_GAP_MS + ROUND_COUNTDOWN_MS;
    expect(timeBank.lastInputMs({ tapsMs: [] }, four)).toBe(0);
    expect(timeBank.lastInputMs({ tapsMs: [15_200] }, four)).toBe(15_200);
    expect(timeBank.lastInputMs({ tapsMs: [15_200, 18_900] }, four)).toBe(15_200 + between + 18_900);
    // A round with no tap counts until its timeout (18,000 + 10,000).
    expect(timeBank.lastInputMs({ tapsMs: [15_200, null] }, four)).toBe(15_200 + between + 28_000);
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i times a full on-target run", (seed) => {
    const params = paramsFromSeed(seed);
    const targets = params.rounds.map((round) => round.targetMs);
    const expected = targets.reduce((sum, t) => sum + t, 0) + 3 * (ROUND_GAP_MS + RUN_COUNTDOWN_MS);
    expect(timeBank.lastInputMs({ tapsMs: targets }, params)).toBe(expected);
  });
});
