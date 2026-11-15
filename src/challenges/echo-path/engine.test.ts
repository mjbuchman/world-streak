import { describe, expect, it } from "vitest";
import {
  COLS,
  LIVES,
  MAX_LENGTH,
  MAX_TAPS,
  ROWS,
  START_LENGTH,
  STEP_MS_RANGE,
  echoPath,
  paramsFromSeed,
  play,
  sequenceFor,
  type EchoPathParams,
} from "./engine";

const params: EchoPathParams = paramsFromSeed(7);

/** Taps one second apart from tile lists. */
const run = (...tiles: number[][]) => ({ taps: tiles.flat().map((tile, i) => ({ tile, atMs: 1000 * (i + 1) })) });
/** The taps that clear a length on a try. */
const clear = (length: number, tryIndex = 0) => sequenceFor(params, length, tryIndex);
/** A tap that is wrong as the first of a length's try (any tile but the first one shown). */
const wrongFirst = (length: number, tryIndex: number) => [(clear(length, tryIndex)[0] + 1) % (COLS * ROWS)];

describe("Echo Path params", () => {
  it("documents the placeholders: a 3 x 3 grid, lengths 3 to 12, 3 lives", () => {
    expect([COLS, ROWS, START_LENGTH, MAX_LENGTH, LIVES]).toEqual([3, 3, 3, 12, 3]);
  });

  it("give every seed 0 to 999 the grid, the lengths and a step speed inside its range", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const p = paramsFromSeed(seed);
      expect(p).toMatchObject({ cols: 3, rows: 3, startLength: 3, maxLength: 12 });
      expect(p.stepMs % 50).toBe(0);
      expect(p.stepMs).toBeGreaterThanOrEqual(STEP_MS_RANGE.min);
      expect(p.stepMs).toBeLessThanOrEqual(STEP_MS_RANGE.max);
      expect(paramsFromSeed(seed)).toEqual(p);
    }
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG or the ranges changes these)", (seed) => {
    const p = paramsFromSeed(seed);
    expect({ stepMs: p.stepMs, first: sequenceFor(p, 3, 0) }).toMatchSnapshot();
  });
});

describe("Echo Path sequences", () => {
  it("are the asked length, inside the grid, never the same tile twice in a row, for seeds 0 to 199", () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = paramsFromSeed(seed);
      for (let length = START_LENGTH; length <= MAX_LENGTH; length++) {
        for (let tryIndex = 0; tryIndex < LIVES; tryIndex++) {
          const tiles = sequenceFor(p, length, tryIndex);
          expect(tiles).toHaveLength(length);
          expect(tiles.every((tile) => Number.isInteger(tile) && tile >= 0 && tile < COLS * ROWS)).toBe(true);
          expect(tiles.some((tile, i) => i > 0 && tile === tiles[i - 1])).toBe(false);
        }
      }
    }
  });

  it("are the same for the same length and try, and new for a retry", () => {
    expect(sequenceFor(params, 5, 1)).toEqual(sequenceFor(params, 5, 1));
    expect(sequenceFor(params, 5, 1)).not.toEqual(sequenceFor(params, 5, 0));
    expect(sequenceFor(params, 5, 0)).not.toEqual(sequenceFor({ ...params, sequenceSeed: params.sequenceSeed + 1 }, 5, 0));
  });
});

describe("Echo Path score", () => {
  it("clearing 3, 4 and 5, then three wrong first taps, scores 5", () => {
    expect(echoPath.score(params, run(clear(3), clear(4), clear(5), wrongFirst(6, 0), wrongFirst(6, 1), wrongFirst(6, 2)))).toBe(5);
  });

  it("clearing every length to 12 with one mistake scores 12 + 2/3", () => {
    const lengths = Array.from({ length: MAX_LENGTH - START_LENGTH + 1 }, (_, i) => START_LENGTH + i);
    // The mistake: length 7's first tile twice (no tile repeats, so the second is wrong); the retry is new.
    const slip = [clear(7)[0], clear(7)[0]];
    const taps = lengths.flatMap((length) => (length === 7 ? [slip, clear(7, 1)] : [clear(length)]));
    expect(echoPath.score(params, run(...taps))).toBe(12.667);
  });

  it("a wrong first tap three times scores 0", () => {
    expect(echoPath.score(params, run(wrongFirst(3, 0), wrongFirst(3, 1), wrongFirst(3, 2)))).toBe(0);
  });

  it("a retry follows the new sequence", () => {
    expect(play(params, run(wrongFirst(3, 0), clear(3, 1)))).toMatchObject({ longest: 3, lives: 2 });
  });

  it("ignores taps after the run has ended", () => {
    const over = run(wrongFirst(3, 0), wrongFirst(3, 1), wrongFirst(3, 2), clear(3));
    expect(echoPath.score(params, over)).toBe(0);
  });

  it("is higher-better and the same every time for the same taps (property)", () => {
    expect(echoPath.direction).toBe("higher-better");
    for (let seed = 0; seed < 100; seed++) {
      const p = paramsFromSeed(seed);
      const taps = run(sequenceFor(p, 3, 0), sequenceFor(p, 4, 0).map((tile, i) => (i === seed % 4 ? (tile + 1) % 9 : tile)));
      const first = echoPath.score(p, taps);
      expect(echoPath.score(p, taps)).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(MAX_LENGTH + 1);
    }
  });
});

describe("Echo Path play", () => {
  it("tracks the length, the place in it, the lives and the try for the game to show", () => {
    expect(play(params, run())).toEqual({ length: 3, position: 0, lives: 3, tryIndex: 0, longest: 0, finished: false });
    expect(play(params, run(clear(3).slice(0, 2)))).toMatchObject({ length: 3, position: 2 });
    expect(play(params, run(clear(3)))).toEqual({ length: 4, position: 0, lives: 3, tryIndex: 0, longest: 3, finished: false });
    expect(play(params, run(clear(3), wrongFirst(4, 0)))).toEqual({ length: 4, position: 0, lives: 2, tryIndex: 1, longest: 3, finished: false });
  });
});

describe("Echo Path inputs", () => {
  it("accept tiles in the grid at rising times, up to MAX_TAPS", () => {
    expect(echoPath.inputsSchema.safeParse(run([0, 8])).success).toBe(true);
    expect(echoPath.inputsSchema.safeParse({ taps: [] }).success).toBe(true);
    expect(echoPath.inputsSchema.safeParse(run(Array<number>(MAX_TAPS).fill(1))).success).toBe(true);
  });

  it.each([
    ["a tile outside the grid", run([9])],
    ["a negative tile", run([-1])],
    ["a fractional tile", run([1.5])],
    ["a negative time", { taps: [{ tile: 1, atMs: -1 }] }],
    ["times that do not rise", { taps: [{ tile: 1, atMs: 5 }, { tile: 2, atMs: 5 }] }],
    ["more taps than MAX_TAPS", run(Array<number>(MAX_TAPS + 1).fill(1))],
  ])("reject %s", (_name, inputs) => {
    expect(echoPath.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("bound the taps by the longest possible run: every length cleared, with two full misses at the end", () => {
    let total = 0;
    for (let length = START_LENGTH; length <= MAX_LENGTH; length++) total += length;
    expect(MAX_TAPS).toBe(total + (LIVES - 1) * MAX_LENGTH);
  });

  it("are finished once the lives run out or the longest length is cleared", () => {
    expect(echoPath.finished(params, run())).toBe(false);
    expect(echoPath.finished(params, run(clear(3), wrongFirst(4, 0)))).toBe(false);
    expect(echoPath.finished(params, run(wrongFirst(3, 0), wrongFirst(3, 1), wrongFirst(3, 2)))).toBe(true);
    const short = { ...params, maxLength: 4 };
    expect(echoPath.finished(short, run(sequenceFor(short, 3, 0), sequenceFor(short, 4, 0)))).toBe(true);
  });

  it("time the latest input at the last tap", () => {
    expect(echoPath.lastInputMs(run(), params)).toBe(0);
    expect(echoPath.lastInputMs(run([1, 2, 3]), params)).toBe(3000);
  });
});
