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
  innerClock,
  type InnerClockParams,
} from "./engine";

/** Explicit params from the backlog's worked examples (T217): a 4 s bank. */
function withTargets(...targetsMs: number[]): InnerClockParams {
  return { budgetMs: 4_000, rounds: targetsMs.map((targetMs) => ({ targetMs, revealMs: REVEAL_MS, timeoutMs: targetMs + 4_000 })) };
}

const four = withTargets(10_000, 13_000, 16_000, 19_000);

describe("Time Bank params", () => {
  it("documents the values: a 4 s bank, 4 rounds, a 2 s clock, 10 to 20 s targets (T202, T217)", () => {
    expect(BUDGET_MS).toBe(4_000);
    expect(ROUNDS).toBe(4);
    expect(REVEAL_MS).toBe(2000);
    expect(ROUND_COUNTDOWN_MS).toBe(RUN_COUNTDOWN_MS);
    expect(TARGET_RANGES_MS).toEqual([
      { min: 10_000, max: 12_400 },
      { min: 12_500, max: 14_900 },
      { min: 15_000, max: 17_400 },
      { min: 17_500, max: 19_900 },
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
    ["perfect taps: four rounds and the whole bank", [10_000, 13_000, 16_000, 19_000], 5],
    ["error 500 in round 1: four rounds and 0.875 of the bank", [10_500, 13_000, 16_000, 19_000], 4.875],
    ["errors 400 and 800: four rounds and 0.7 left", [10_400, 13_800, 16_000, 19_000], 4.7],
    ["an error of exactly the bank in round 1 survives with nothing left", [14_000, 13_000, 16_000, 19_000], 4],
    ["errors of 1,000 every round spend exactly the bank", [11_000, 12_000, 17_000, 18_000], 4],
    ["an error past the bank in round 1 busts it", [14_001], 0],
    ["no tap in round 1", [null], 0],
    ["a good round, then no tap", [10_000, null], 1],
  ])("%s", (_name, tapsMs, score) => {
    expect(innerClock.score(four, { tapsMs })).toBe(score);
  });

  it("makes a missing or late tap cost more than the whole bank, and a tap at the timeout itself", () => {
    const round = four.rounds[0];
    expect(roundErrorMs(round, null, 4_000)).toBe(4_001);
    expect(roundErrorMs(round, 14_000.5, 4_000)).toBe(4_001);
    expect(roundErrorMs(round, 14_000, 4_000)).toBe(4_000);
    expect(roundErrorMs(round, 9_000, 4_000)).toBe(1000);
  });

  it("rounds each error to the millisecond and the score to 3 decimals", () => {
    // Error 1,000.4 ms rounds to 1,000: 3,000 of 4,000 left.
    expect(play(withTargets(10_000), { tapsMs: [11_000.4] })).toEqual({ survived: 1, left: 3000, failed: false });
    // 1 + 3,877 / 4,000 = 1.96925.
    expect(innerClock.score(withTargets(10_000), { tapsMs: [10_123.4] })).toBe(1.969);
  });

  it("ignores taps after the round that emptied the bank, and taps beyond the rounds", () => {
    expect(innerClock.score(four, { tapsMs: [null, 13_000, 16_000] })).toBe(0);
    expect(play(withTargets(10_000), { tapsMs: [10_000, 1] })).toEqual({ survived: 1, left: 4_000, failed: false });
  });

  it.each([
    // Mid-range taps miss each round by up to 1.2 s; a 4 s bank lasts these runs (2 s did not).
    [0, 4.15],
    [1, 4.3],
    [4_294_967_295, 4.15],
  ])("golden: seed %i with fixed taps scores %s (changing the PRNG or the ranges changes these)", (seed, score) => {
    const tapsMs = [11_200, 13_700, 16_200, 18_700];
    expect(innerClock.score(paramsFromSeed(seed), { tapsMs })).toBe(score);
  });

  it("gives the same score for the same taps, between 0 and the number of rounds plus one (property)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const params = paramsFromSeed(seed);
      const tapsMs = params.rounds.map((round, i) => round.targetMs + ((seed * 37 + i * 211) % 4000) - 2000);
      const first = innerClock.score(params, { tapsMs });
      expect(innerClock.score(params, { tapsMs })).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(ROUNDS + 1);
    }
  });

  it("is higher-better", () => {
    expect(innerClock.direction).toBe("higher-better");
  });
});

describe("Time Bank balance", () => {
  /**
   * A simulated player whose error is roughly normal with a fixed spread (standard deviation) of
   * SPREAD_MS, 250 ms (T217). Its error is capped at 3 spreads (750 ms) a round, so four rounds
   * cost at most 3 s and every run survives the 4 s bank: the owner wanted it gentler (M7 play-test).
   */
  const SPREAD_MS = 250;

  function survivesAll(seed: number): boolean {
    const params = paramsFromSeed(seed);
    const rng = createRng(seed + 1_000_000);
    const tapsMs = params.rounds.map((round) => {
      const normalish = (rng.next() + rng.next() + rng.next() - 1.5) * 2;
      return Math.max(0, Math.round(round.targetMs + SPREAD_MS * normalish));
    });
    return innerClock.score(params, { tapsMs }) >= ROUNDS;
  }

  it("lets that player survive all four rounds every time (measured: 1,000 of 1,000)", () => {
    let survived = 0;
    for (let seed = 0; seed < 1000; seed++) if (survivesAll(seed)) survived++;
    expect(survived).toBe(1000);
  });
});

describe("Time Bank inputs", () => {
  it("accept one tap or null per round played", () => {
    expect(innerClock.inputsSchema.safeParse({ tapsMs: [3200.5, null, 0] }).success).toBe(true);
    expect(innerClock.inputsSchema.safeParse({ tapsMs: [] }).success).toBe(true);
    expect(innerClock.inputsSchema.safeParse({ tapsMs: Array<number>(ROUNDS).fill(1) }).success).toBe(true);
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
    expect(innerClock.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("are finished once a round empties the bank or every round has a tap", () => {
    expect(innerClock.finished(four, { tapsMs: [] })).toBe(false);
    expect(innerClock.finished(four, { tapsMs: [10_000, 13_000, 16_000] })).toBe(false);
    expect(innerClock.finished(four, { tapsMs: [10_000, 13_000, 16_000, 19_000] })).toBe(true);
    expect(innerClock.finished(four, { tapsMs: [null] })).toBe(true);
    expect(innerClock.finished(four, { tapsMs: [14_500] })).toBe(true);
    // An exactly empty bank still leaves the next round to play.
    expect(innerClock.finished(four, { tapsMs: [14_000] })).toBe(false);
  });

  it("time the latest tap from the run start: every tap, plus the gap and the 3-2-1 before each later round", () => {
    const between = ROUND_GAP_MS + ROUND_COUNTDOWN_MS;
    expect(innerClock.lastInputMs({ tapsMs: [] }, four)).toBe(0);
    expect(innerClock.lastInputMs({ tapsMs: [10_200] }, four)).toBe(10_200);
    expect(innerClock.lastInputMs({ tapsMs: [10_200, 13_900] }, four)).toBe(10_200 + between + 13_900);
    // A round with no tap counts until its timeout (13,000 + 4,000).
    expect(innerClock.lastInputMs({ tapsMs: [10_200, null] }, four)).toBe(10_200 + between + 17_000);
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i times a full on-target run", (seed) => {
    const params = paramsFromSeed(seed);
    const targets = params.rounds.map((round) => round.targetMs);
    const expected = targets.reduce((sum, t) => sum + t, 0) + 3 * (ROUND_GAP_MS + RUN_COUNTDOWN_MS);
    expect(innerClock.lastInputMs({ tapsMs: targets }, params)).toBe(expected);
  });
});
