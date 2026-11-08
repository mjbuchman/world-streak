/**
 * The one seeded PRNG every challenge uses, so the client and the server build the same
 * instance from a seed. Algorithm: mulberry32 (public domain), a 32-bit generator that is
 * fast, small and good enough for game layouts. It is not cryptographically secure; seeds
 * are issued by the server, so players cannot choose them.
 *
 * Changing the algorithm changes every seed's instance: keep `prng.golden.json` passing.
 */
export type Rng = {
  /** A float in [0, 1). */
  next(): number;
  /** An integer from `min` to `max`, both inclusive. */
  int(min: number, max: number): number;
  /** One item of a non-empty list. */
  pick<T>(items: readonly T[]): T;
};

const UINT32_MAX = 0xffffffff;

export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError(`Seed must be an unsigned 32-bit integer, got ${seed}`);
  }
  let state = seed | 0;

  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  }

  function int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError(`int(min, max) needs integers with min <= max, got (${min}, ${max})`);
    }
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("pick() needs at least one item");
    return items[int(0, items.length - 1)];
  }

  return { next, int, pick };
}
