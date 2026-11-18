import { describe, expect, it } from "vitest";
import { bankScore, playBank } from "./bank";
import { createRng } from "./prng";

const scoreOf = (total: number, costs: number[]) => {
  const { survived, left } = playBank(total, costs);
  return bankScore(survived, left, total);
};

describe("playBank", () => {
  it("survives a round that uses the bank up exactly", () => {
    expect(playBank(10, [2, 3, 5])).toEqual({ survived: 3, left: 0, failed: false });
    expect(scoreOf(10, [2, 3, 5])).toBe(3);
  });

  it("ends the run at the first cost above what is left", () => {
    expect(playBank(10, [2, 3, 6])).toEqual({ survived: 2, left: 0, failed: true });
    expect(scoreOf(10, [2, 3, 6])).toBe(2);
  });

  it("ignores costs after the round that failed", () => {
    expect(playBank(10, [11, 0, 0])).toEqual({ survived: 0, left: 0, failed: true });
  });

  it("with no costs keeps the whole bank", () => {
    expect(playBank(10, [])).toEqual({ survived: 0, left: 10, failed: false });
    expect(scoreOf(10, [])).toBe(1);
  });

  it("tolerates floating-point drift: 0.1 + 0.2 of 0.3 survives", () => {
    const result = playBank(0.3, [0.1, 0.2]);
    expect(result.survived).toBe(2);
    expect(result.failed).toBe(false);
    expect(result.left).toBeCloseTo(0);
    expect(result.left).toBeGreaterThanOrEqual(0);
  });
});

describe("bankScore", () => {
  it("adds the bank left as a fraction, to 3 decimals", () => {
    expect(bankScore(4, 9500, 10_000)).toBe(4.95);
    expect(bankScore(1, 2, 3)).toBe(1.667);
  });
});

describe("bank properties", () => {
  it("never scores lower when a cost gets smaller, and never survives more rounds than costs", () => {
    const rng = createRng(42);
    for (let run = 0; run < 2000; run++) {
      const total = rng.int(1, 20);
      const costs = Array.from({ length: rng.int(0, 6) }, () => rng.int(0, 12) + rng.next());
      const result = playBank(total, costs);
      expect(result.survived).toBeLessThanOrEqual(costs.length);
      if (costs.length === 0) continue;
      const index = rng.int(0, costs.length - 1);
      const smaller = costs.map((cost, i) => (i === index ? cost * rng.next() : cost));
      expect(scoreOf(total, smaller)).toBeGreaterThanOrEqual(scoreOf(total, costs));
    }
  });
});
