import { describe, expect, it } from "vitest";
import { COLS, fallbackPath, isValidPath, MAX_PATH_LENGTH, MIN_PATH_LENGTH, pathFor, ROWS } from "./path";

const SEEDS = Array.from({ length: 10_000 }, (_, seed) => seed);
const paths = SEEDS.map((seed) => pathFor(seed));
const row = (tile: number) => Math.floor(tile / COLS);
const col = (tile: number) => tile % COLS;
/** Builds a path from (row, col) pairs, so the hand-built cases read as moves on the board. */
const at = (...cells: [number, number][]) => cells.map(([r, c]) => r * COLS + c);
/** Straight up one column from row 0 to the top: 10 tiles. */
const column = (c: number, from = 0) => Array.from({ length: ROWS - from }, (_, r) => (r + from) * COLS + c);

describe("the board", () => {
  it("is 5 columns by 10 rows, with paths of 12 to 18 tiles", () => {
    expect({ COLS, ROWS, MIN_PATH_LENGTH, MAX_PATH_LENGTH }).toEqual({ COLS: 5, ROWS: 10, MIN_PATH_LENGTH: 12, MAX_PATH_LENGTH: 18 });
  });
});

describe("pathFor", () => {
  it("keeps every rule for seeds 0 to 9 999", () => {
    const broken = SEEDS.filter((seed) => !isValidPath(paths[seed]));
    expect(broken).toEqual([]);
  });

  it("checks the rules itself too: bottom start, top end, adjacent steps, no revisits", () => {
    for (const path of paths.slice(0, 500)) {
      expect(row(path[0])).toBe(0);
      expect(row(path.at(-1)!)).toBe(ROWS - 1);
      expect(path.slice(0, -1).every((tile) => row(tile) < ROWS - 1)).toBe(true);
      expect(new Set(path).size).toBe(path.length);
      for (let i = 1; i < path.length; i++) {
        const dRow = row(path[i]) - row(path[i - 1]);
        const dCol = col(path[i]) - col(path[i - 1]);
        expect([0, 1]).toContain(dRow);
        expect(Math.abs(dCol)).toBeLessThanOrEqual(1);
        expect(dRow + Math.abs(dCol)).toBeGreaterThan(0);
      }
      // Length = 10 rows + sideways steps.
      expect(path.length - ROWS).toBe(path.slice(1).filter((tile, i) => row(tile) === row(path[i])).length);
    }
  });

  it("keeps the two-in-a-row limit at the edges, where only one forward move may exist", () => {
    const edge = paths.filter((path) => path.some((tile) => col(tile) === 0) && path.some((tile) => col(tile) === COLS - 1));
    expect(edge.length).toBeGreaterThan(100);
    expect(edge.every(isValidPath)).toBe(true);
  });

  it("covers every length from 12 to 18", () => {
    const lengths = new Set(paths.map((path) => path.length));
    expect([...lengths].sort((a, b) => a - b)).toEqual([12, 13, 14, 15, 16, 17, 18]);
  });

  it("starts in every column", () => {
    expect(new Set(paths.map((path) => col(path[0]))).size).toBe(COLS);
  });

  it("gives the same path for the same seed", () => {
    expect(pathFor(42)).toEqual(pathFor(42));
    expect(pathFor(0xffff_ffff)).toEqual(pathFor(0xffff_ffff));
  });

  it("gives at least 95% distinct paths over 1 000 seeds", () => {
    const distinct = new Set(paths.slice(0, 1000).map((path) => path.join(",")));
    expect(distinct.size).toBeGreaterThanOrEqual(950);
  });

  it("falls back to a fixed path that keeps every rule when no walk reaches the minimum", () => {
    const path = pathFor(7, 0);
    expect(path).toEqual(fallbackPath(col(pathFor(7)[0])));
    expect(isValidPath(path)).toBe(true);
  });
});

describe("fallbackPath", () => {
  it("keeps every rule from each start column", () => {
    for (let c = 0; c < COLS; c++) {
      const path = fallbackPath(c);
      expect(path[0]).toBe(c);
      expect(path).toHaveLength(13);
      expect(isValidPath(path)).toBe(true);
    }
  });
});

describe("isValidPath", () => {
  // A valid 12-tile base: right, then up column 1 alternating straight and diagonal steps.
  const valid = at([0, 0], [0, 1], [1, 1], [2, 2], [3, 2], [4, 1], [5, 1], [6, 2], [7, 2], [8, 1], [9, 1]);
  const twelve = at([0, 0], [0, 1], [0, 2], [1, 2], [2, 3], [3, 3], [4, 2], [5, 2], [6, 3], [7, 3], [8, 2], [9, 2]);

  it("accepts a hand-built path that keeps the rules", () => {
    expect(isValidPath(twelve)).toBe(true);
  });

  it("rejects three of the same move in a row", () => {
    // Up column 0 three times running, padded with sideways steps to reach 12 tiles.
    expect(isValidPath(at([0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 3], [6, 3], [7, 2], [8, 2], [9, 3]))).toBe(false);
  });

  it("rejects a revisit", () => {
    expect(isValidPath(at([0, 0], [0, 1], [0, 0], [1, 0], [2, 1], [3, 1], [4, 0], [5, 0], [6, 1], [7, 1], [8, 0], [9, 0]))).toBe(false);
  });

  it("rejects a diagonal step sideways or back, and a jump", () => {
    // (0,1) to (1,2) is fine; (1,2) back down to (0,3) is a diagonal backward step.
    expect(isValidPath(at([0, 0], [0, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 4], [4, 3], [5, 3], [6, 4], [7, 4], [8, 3], [9, 3]))).toBe(false);
    // From the right edge of row 0 to the left edge of row 1: next index, but not adjacent.
    expect(isValidPath(at([0, 4], [1, 0], [1, 1], [1, 2], [2, 2], [3, 3], [4, 3], [5, 2], [6, 2], [7, 3], [8, 3], [9, 2]))).toBe(false);
  });

  it("rejects paths too short or too long, off the board, not from the bottom, or past the top", () => {
    expect(isValidPath(valid)).toBe(false);
    expect(isValidPath(column(0))).toBe(false);
    expect(isValidPath([...twelve.slice(0, -1), 50])).toBe(false);
    expect(isValidPath([5, ...twelve.slice(1)])).toBe(false);
    expect(isValidPath([...twelve, 48])).toBe(false);
    expect(isValidPath([0.5, ...twelve.slice(1)])).toBe(false);
    const long = at([0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [4, 2], [4, 3], [5, 3], [5, 4], [6, 4], [6, 3], [7, 3], [7, 2], [8, 2], [8, 1], [9, 1]);
    expect(long).toHaveLength(19);
    expect(isValidPath(long)).toBe(false);
  });
});
