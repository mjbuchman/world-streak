import { describe, expect, it } from "vitest";
import golden from "./prng.golden.json";
import { createRng } from "./prng";

const draws = (seed: number, count: number) => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

describe("createRng", () => {
  it("gives an identical sequence for the same seed over 10,000 draws", () => {
    expect(draws(123456789, 10_000)).toEqual(draws(123456789, 10_000));
  });

  it("matches the committed mulberry32 golden values for seeds 0, 42 and 4294967295", () => {
    // Generated once from an independent reference implementation of mulberry32. If this
    // fails, every challenge's seeds now produce different instances: never update the
    // fixture to make it pass.
    for (const [seed, values] of Object.entries(golden)) {
      expect(draws(Number(seed), 5)).toEqual(values);
    }
  });

  it("always returns next() in [0, 1)", () => {
    for (const seed of [0, 1, 42, 2 ** 31, 4294967295]) {
      for (const value of draws(seed, 10_000)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it("gives different first values for seeds 1 and 2", () => {
    expect(draws(1, 1)[0]).not.toBe(draws(2, 1)[0]);
  });

  it.each([-1, 4294967296, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %s, which is not an unsigned 32-bit integer seed",
    (seed) => {
      expect(() => createRng(seed)).toThrow(RangeError);
    },
  );
});

describe("int", () => {
  it("returns only 3 to 7 inclusive, and each of them, in 1,000 draws", () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(3, 7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it("returns the only possible value when min equals max", () => {
    expect(createRng(1).int(4, 4)).toBe(4);
  });

  it("works for negative ranges", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const value = rng.int(-2, 0);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThanOrEqual(0);
      seen.add(value);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0]);
  });

  it.each([
    [7, 3],
    [1.5, 3],
    [0, Number.NaN],
  ])("rejects the invalid range int(%s, %s)", (min, max) => {
    expect(() => createRng(1).int(min, max)).toThrow(RangeError);
  });

  it("draws from the same sequence as next()", () => {
    const a = createRng(99);
    const b = createRng(99);
    expect(a.int(0, 99)).toBe(Math.floor(b.next() * 100));
  });
});

describe("pick", () => {
  it("picks items from the list, reaching each of them", () => {
    const rng = createRng(5);
    const items = ["a", "b", "c"] as const;
    const seen = new Set(Array.from({ length: 300 }, () => rng.pick(items)));
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
  });

  it("is deterministic for a seed", () => {
    const pickFive = () => {
      const rng = createRng(11);
      return Array.from({ length: 5 }, () => rng.pick([1, 2, 3, 4, 5, 6]));
    };
    expect(pickFive()).toEqual(pickFive());
  });

  it("rejects an empty list", () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });
});
