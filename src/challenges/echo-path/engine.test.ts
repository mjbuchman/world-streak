import { describe, expect, it } from "vitest";
import { COLS, LIVES, MAX_TAPS, ROWS, START_LENGTH, STEP_MS_RANGE, echoPath, paramsFromSeed, play, sequenceFor, type EchoPathParams } from "./engine";
import { isValidPath, MAX_PATH_LENGTH } from "./path";

/** The worked examples' path: 12 tiles from row 0 to row 9 (row * 5 + col). */
const TWELVE = [0, 1, 2, 7, 13, 18, 22, 27, 33, 38, 42, 47];
const params: EchoPathParams = { cols: COLS, rows: ROWS, path: TWELVE, startLength: START_LENGTH, stepMs: 350 };

/** Taps one second apart from tile lists. */
const run = (...tiles: number[][]) => ({ taps: tiles.flat().map((tile, i) => ({ tile, atMs: 1000 * (i + 1) })) });
const lengths = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** The taps that clear these lengths, one after another. */
const clear = (p: EchoPathParams, ...ls: number[]) => ls.map((length) => sequenceFor(p, length));
/** A first tap that is wrong (the path's first tile is never its second). */
const wrongFirst = (p: EchoPathParams) => [p.path[1]];

describe("Echo Path params", () => {
  it("documents the numbers: a 5 x 10 board, a start of 4, 3 lives", () => {
    expect([COLS, ROWS, START_LENGTH, LIVES]).toEqual([5, 10, 4, 3]);
    expect(STEP_MS_RANGE).toEqual({ min: 300, max: 400 });
  });

  it("give every seed 0 to 999 a valid path and a step speed inside its range", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const p = paramsFromSeed(seed);
      expect(p).toMatchObject({ cols: 5, rows: 10, startLength: 4 });
      expect(isValidPath(p.path)).toBe(true);
      expect(p.stepMs % 50).toBe(0);
      expect(p.stepMs).toBeGreaterThanOrEqual(STEP_MS_RANGE.min);
      expect(p.stepMs).toBeLessThanOrEqual(STEP_MS_RANGE.max);
      expect(paramsFromSeed(seed)).toEqual(p);
    }
  });

  it("give players different paths: at least 95% distinct over 1 000 seeds", () => {
    const distinct = new Set(Array.from({ length: 1000 }, (_, seed) => paramsFromSeed(seed).path.join(",")));
    expect(distinct.size).toBeGreaterThanOrEqual(950);
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG, the path rules or the ranges changes these)", (seed) => {
    const p = paramsFromSeed(seed);
    const full = run(...clear(p, ...lengths(START_LENGTH, p.path.length)));
    const slips = run(...clear(p, 4, 5), wrongFirst(p), wrongFirst(p), clear(p, 6)[0]);
    expect({ stepMs: p.stepMs, path: p.path, full: echoPath.score(p, full), slips: echoPath.score(p, slips) }).toMatchSnapshot();
  });
});

describe("Echo Path rounds", () => {
  it("play the path's first tiles, the same on every try", () => {
    expect(sequenceFor(params, 4)).toEqual([0, 1, 2, 7]);
    expect(sequenceFor(params, 5)).toEqual([0, 1, 2, 7, 13]);
  });

  it("add the path's next tile after a clear, and replay the same length after a miss", () => {
    expect(play(params, run())).toEqual({ length: 4, position: 0, lives: 3, longest: 0, finished: false });
    expect(play(params, run([0, 1]))).toMatchObject({ length: 4, position: 2 });
    expect(play(params, run(...clear(params, 4)))).toEqual({ length: 5, position: 0, lives: 3, longest: 4, finished: false });
    expect(play(params, run(...clear(params, 4), [0, 1, 3]))).toEqual({ length: 5, position: 0, lives: 2, longest: 4, finished: false });
    expect(play(params, run(...clear(params, 4), [0, 1, 3], ...clear(params, 5)))).toMatchObject({ length: 6, lives: 2, longest: 5 });
  });
});

describe("Echo Path score", () => {
  it("tapping all 12 tiles of a 12-tile path correctly scores 12 + 1 = 13", () => {
    expect(echoPath.score(params, run(...clear(params, ...lengths(4, 12))))).toBe(13);
  });

  it("clearing 4 to 7, then missing three times, scores 7", () => {
    expect(echoPath.score(params, run(...clear(params, ...lengths(4, 7)), wrongFirst(params), wrongFirst(params), wrongFirst(params)))).toBe(7);
  });

  it("clearing everything with two misses on the way scores 12 + 1/3", () => {
    const taps = run(...clear(params, 4, 5), wrongFirst(params), ...clear(params, 6, 7, 8), [0, 1, 2, 7, 13, 18, 22, 27, 0], ...clear(params, ...lengths(9, 12)));
    expect(echoPath.score(params, taps)).toBe(12.333);
  });

  it("three wrong first taps score 0", () => {
    expect(echoPath.score(params, run(wrongFirst(params), wrongFirst(params), wrongFirst(params)))).toBe(0);
  });

  it("ignores taps after the run has ended", () => {
    expect(echoPath.score(params, run(wrongFirst(params), wrongFirst(params), wrongFirst(params), ...clear(params, 4)))).toBe(0);
    expect(echoPath.score(params, run(...clear(params, ...lengths(4, 12)), [5, 5, 5]))).toBe(13);
  });

  it("is higher-better and the same every time for the same taps (property)", () => {
    expect(echoPath.direction).toBe("higher-better");
    for (let seed = 0; seed < 100; seed++) {
      const p = paramsFromSeed(seed);
      const taps = run(sequenceFor(p, 4), sequenceFor(p, 5).map((tile, i) => (i === seed % 5 ? (tile + 1) % (COLS * ROWS) : tile)));
      const first = echoPath.score(p, taps);
      expect(echoPath.score(p, taps)).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(MAX_PATH_LENGTH + 1);
    }
  });
});

describe("Echo Path inputs", () => {
  it("accept tiles on the board at rising times, up to MAX_TAPS", () => {
    expect(echoPath.inputsSchema.safeParse(run([0, 49])).success).toBe(true);
    expect(echoPath.inputsSchema.safeParse({ taps: [] }).success).toBe(true);
    expect(echoPath.inputsSchema.safeParse(run(Array<number>(MAX_TAPS).fill(1))).success).toBe(true);
  });

  it.each([
    ["a tile off the board", run([50])],
    ["a negative tile", run([-1])],
    ["a fractional tile", run([1.5])],
    ["a negative time", { taps: [{ tile: 1, atMs: -1 }] }],
    ["times that do not rise", { taps: [{ tile: 1, atMs: 5 }, { tile: 2, atMs: 5 }] }],
    ["times that fall", { taps: [{ tile: 1, atMs: 5 }, { tile: 2, atMs: 4 }] }],
    ["more taps than MAX_TAPS", run(Array<number>(MAX_TAPS + 1).fill(1))],
  ])("reject %s", (_name, inputs) => {
    expect(echoPath.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("bound the taps by the longest run: every length of an 18-tile path cleared, with two full misses at the end", () => {
    const total = lengths(START_LENGTH, MAX_PATH_LENGTH).reduce((sum, length) => sum + length, 0);
    expect(MAX_TAPS).toBe(total + (LIVES - 1) * MAX_PATH_LENGTH);
    expect(MAX_TAPS).toBe(201);
  });

  it("are finished once the lives run out or the whole path is cleared", () => {
    expect(echoPath.finished(params, run())).toBe(false);
    expect(echoPath.finished(params, run(...clear(params, 4), wrongFirst(params)))).toBe(false);
    expect(echoPath.finished(params, run(wrongFirst(params), wrongFirst(params), wrongFirst(params)))).toBe(true);
    expect(echoPath.finished(params, run(...clear(params, ...lengths(4, 11))))).toBe(false);
    expect(echoPath.finished(params, run(...clear(params, ...lengths(4, 12))))).toBe(true);
  });

  it("time the latest input at the last tap", () => {
    expect(echoPath.lastInputMs(run(), params)).toBe(0);
    expect(echoPath.lastInputMs(run([1, 2, 3]), params)).toBe(3000);
  });
});
