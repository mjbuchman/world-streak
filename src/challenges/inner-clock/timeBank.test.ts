import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import {
  BUDGET_MS,
  MAX_ROUNDS,
  REVEAL_RANGE_MS,
  ROUND_GAP_MS,
  TARGET_RANGES_MS,
  TIMEOUT_FACTOR,
  paramsFromSeed,
  timeBank,
  type TimeBankParams,
} from "./timeBank";

/** Explicit params from the backlog's worked examples: targets 3, 4 and 5 s, a 3 s budget. */
function withTargets(...targetsMs: number[]): TimeBankParams {
  return {
    budgetMs: 3000,
    rounds: targetsMs.map((targetMs) => ({ targetMs, revealMs: 1000, timeoutMs: TIMEOUT_FACTOR * targetMs })),
  };
}

const three = withTargets(3000, 4000, 5000);

describe("Time Bank params", () => {
  it("documents the placeholders: a 3 s budget, 8 rounds, 3x timeouts", () => {
    expect(BUDGET_MS).toBe(3000);
    expect(MAX_ROUNDS).toBe(8);
    expect(TIMEOUT_FACTOR).toBe(3);
    expect(TARGET_RANGES_MS).toHaveLength(MAX_ROUNDS);
  });

  it("give every seed 0 to 999 rising targets and shrinking clocks inside the documented ranges", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const params = paramsFromSeed(seed);
      expect(params.budgetMs).toBe(BUDGET_MS);
      expect(params.rounds).toHaveLength(MAX_ROUNDS);
      params.rounds.forEach((round, i) => {
        expect(round.targetMs % 100).toBe(0);
        expect(round.targetMs).toBeGreaterThanOrEqual(TARGET_RANGES_MS[i].min);
        expect(round.targetMs).toBeLessThanOrEqual(TARGET_RANGES_MS[i].max);
        expect(round.revealMs).toBeGreaterThanOrEqual(REVEAL_RANGE_MS.min);
        expect(round.revealMs).toBeLessThanOrEqual(REVEAL_RANGE_MS.max);
        // The visible clock never gives the answer away.
        expect(round.revealMs).toBeLessThan(round.targetMs);
        expect(round.timeoutMs).toBe(TIMEOUT_FACTOR * round.targetMs);
        if (i > 0) {
          expect(round.targetMs).toBeGreaterThan(params.rounds[i - 1].targetMs);
          expect(round.revealMs).toBeLessThan(params.rounds[i - 1].revealMs);
        }
      });
    }
  });

  it("are the same for the same seed", () => {
    for (let seed = 0; seed < 1000; seed++) expect(paramsFromSeed(seed)).toEqual(paramsFromSeed(seed));
  });
});

describe("Time Bank score", () => {
  it.each([
    ["errors 200, 900, then 2,000 with 1,900 left: two rounds", [3200, 4900, 7000], 2],
    ["errors 0, 0, 3,000: the budget runs out exactly and the round survives", [3000, 4000, 8000], 3],
    ["errors of 100 each: three rounds and 0.9 of the budget", [3100, 4100, 5100], 3.9],
    ["errors 0, 0, 3,001: one past the budget fails the round", [3000, 4000, 8001], 2],
    ["no tap in round 1", [null], 0],
    ["a good round, then no tap", [3200, null], 1],
  ])("%s", (_name, tapsMs, score) => {
    expect(timeBank.score(three, { tapsMs })).toBe(score);
  });

  it("scores a tap after the timeout like no tap, and a tap right at the timeout as itself", () => {
    const one = { budgetMs: 20_000, rounds: withTargets(3000).rounds };
    // No tap or a late one costs (3 - 1) x 3,000 = 6,000 ms: 14,000 of 20,000 left.
    expect(timeBank.score(one, { tapsMs: [null] })).toBe(1.7);
    expect(timeBank.score(one, { tapsMs: [9000.5] })).toBe(1.7);
    expect(timeBank.score(one, { tapsMs: [9000] })).toBe(1.7);
    expect(timeBank.score(one, { tapsMs: [8999] })).toBe(1.7);
    expect(timeBank.score(one, { tapsMs: [2000] })).toBe(1.95);
  });

  it("rounds each error to the millisecond and the score to 3 decimals", () => {
    // Error 1,000.4 ms rounds to 1,000: 2,000 of 3,000 left.
    expect(timeBank.score(withTargets(3000), { tapsMs: [4000.4] })).toBe(1.667);
  });

  it("ignores taps after the round that emptied the budget", () => {
    expect(timeBank.score(three, { tapsMs: [null, 4000, 5000] })).toBe(0);
  });

  it.each([
    [0, 7],
    [1, 7],
    [4_294_967_295, 8.067],
  ])("golden: seed %i with fixed taps scores %d (changing the PRNG or the ranges changes these)", (seed, score) => {
    const tapsMs = [3600, 4100, 5700, 6000, 7600, 9000, 9100, 11_000];
    expect(timeBank.score(paramsFromSeed(seed), { tapsMs })).toBe(score);
  });

  it("gives the same score for the same taps, between 0 and the number of rounds (property)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const params = paramsFromSeed(seed);
      const tapsMs = params.rounds.map((round, i) => round.targetMs + ((seed * 37 + i * 211) % 1200) - 600);
      const first = timeBank.score(params, { tapsMs });
      expect(timeBank.score(params, { tapsMs })).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(MAX_ROUNDS + 1);
    }
  });

  it("is higher-better", () => {
    expect(timeBank.direction).toBe("higher-better");
  });
});

describe("Time Bank balance", () => {
  /** A decent player: each tap off by up to 22% of the target either way (11% on average). */
  function decentRun(seed: number): { rounds: number; runMs: number } {
    const params = paramsFromSeed(seed);
    const rng = createRng(seed + 1_000_000);
    const tapsMs: number[] = [];
    for (const round of params.rounds) {
      tapsMs.push(Math.round(round.targetMs * (1 + (rng.next() * 2 - 1) * 0.22)));
      if (timeBank.finished(params, { tapsMs })) break;
    }
    return { rounds: Math.floor(timeBank.score(params, { tapsMs })), runMs: timeBank.lastInputMs({ tapsMs }, params) };
  }

  it("lets a decent player survive about 5 rounds on average", () => {
    let total = 0;
    for (let seed = 0; seed < 1000; seed++) total += decentRun(seed).rounds;
    const average = total / 1000;
    expect(average).toBeGreaterThanOrEqual(4.5);
    expect(average).toBeLessThanOrEqual(5.5);
  });

  it("lasts 45 to 90 s for a full run of on-target taps", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const params = paramsFromSeed(seed);
      const runMs = timeBank.lastInputMs({ tapsMs: params.rounds.map((round) => round.targetMs) }, params);
      expect(runMs).toBeGreaterThanOrEqual(45_000);
      expect(runMs).toBeLessThanOrEqual(90_000);
    }
  });
});

describe("Time Bank inputs", () => {
  it("accept one tap or null per round played", () => {
    expect(timeBank.inputsSchema.safeParse({ tapsMs: [3200.5, null, 0] }).success).toBe(true);
    expect(timeBank.inputsSchema.safeParse({ tapsMs: [] }).success).toBe(true);
    expect(timeBank.inputsSchema.safeParse({ tapsMs: Array<number>(MAX_ROUNDS).fill(1) }).success).toBe(true);
  });

  it.each([
    ["a negative tap", { tapsMs: [-1] }],
    ["an infinite tap", { tapsMs: [Infinity] }],
    ["NaN", { tapsMs: [NaN] }],
    ["a text tap", { tapsMs: ["3000"] }],
    ["more taps than rounds", { tapsMs: Array<number>(MAX_ROUNDS + 1).fill(1) }],
    ["no taps field", {}],
    ["a single tap", { tapMs: 3000 }],
  ])("reject %s", (_name, inputs) => {
    expect(timeBank.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("are finished once a round empties the budget or every round has a tap", () => {
    expect(timeBank.finished(three, { tapsMs: [] })).toBe(false);
    expect(timeBank.finished(three, { tapsMs: [3200, 4900] })).toBe(false);
    expect(timeBank.finished(three, { tapsMs: [3200, 4900, 7000] })).toBe(true);
    expect(timeBank.finished(three, { tapsMs: [null] })).toBe(true);
    expect(timeBank.finished(three, { tapsMs: [3000, 4000, 5000] })).toBe(true);
    // An exactly empty budget still leaves the next round to play.
    expect(timeBank.finished(three, { tapsMs: [6000] })).toBe(false);
  });

  it("time the latest tap from the run start: every tap plus the gaps between rounds", () => {
    expect(timeBank.lastInputMs({ tapsMs: [] }, three)).toBe(0);
    expect(timeBank.lastInputMs({ tapsMs: [3200] }, three)).toBe(3200);
    expect(timeBank.lastInputMs({ tapsMs: [3200, 4900] }, three)).toBe(3200 + ROUND_GAP_MS + 4900);
    // A round with no tap counts until its timeout (3 x 4,000).
    expect(timeBank.lastInputMs({ tapsMs: [3200, null] }, three)).toBe(3200 + ROUND_GAP_MS + 12_000);
  });
});
