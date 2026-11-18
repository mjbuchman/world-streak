import { describe, expect, it } from "vitest";
import { COLS, fallbackPath, isValidPath, MAX_PATH_LENGTH, MIN_PATH_LENGTH, pathFor, ROWS } from "./path";

const SEEDS = Array.from({ length: 10_000 }, (_, seed) => seed);
const paths = SEEDS.map((seed) => pathFor(seed));
const row = (tile: number) => Math.floor(tile / COLS);
const col = (tile: number) => tile % COLS;
/** Builds a path from (row, col) pairs, so the hand-built cases read as moves on the board. */
const at = (...cells: [number, number][]) => cells.map(([r, c]) => r * COLS + c);
/** Pairs of path tiles that are not next to each other in the path but share an edge, found by brute force. */
const cutbacks = (path: number[]) => {
  const found: [number, number][] = [];
  for (let i = 0; i < path.length; i++) {
    for (let j = i + 2; j < path.length; j++) {
      if (Math.abs(row(path[i]) - row(path[j])) + Math.abs(col(path[i]) - col(path[j])) === 1) found.push([i, j]);
    }
  }
  return found;
};

describe("the board", () => {
  it("is 5 columns by 8 rows, with paths of 8 to 12 tiles (T207)", () => {
    expect({ COLS, ROWS, MIN_PATH_LENGTH, MAX_PATH_LENGTH }).toEqual({ COLS: 5, ROWS: 8, MIN_PATH_LENGTH: 8, MAX_PATH_LENGTH: 12 });
  });
});

describe("pathFor", () => {
  it("keeps every rule for seeds 0 to 9 999", () => {
    const broken = SEEDS.filter((seed) => !isValidPath(paths[seed]));
    expect(broken).toEqual([]);
  });

  it("never lets a tile share an edge with any but the tiles just before and after it, for seeds 0 to 9 999", () => {
    expect(SEEDS.filter((seed) => cutbacks(paths[seed]).length > 0)).toEqual([]);
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
      // Length = 8 rows + sideways steps.
      expect(path.length - ROWS).toBe(path.slice(1).filter((tile, i) => row(tile) === row(path[i])).length);
    }
  });

  it("keeps the two-in-a-row limit at the edges, where only one forward move may exist", () => {
    const edge = paths.filter((path) => path.some((tile) => col(tile) === 0) && path.some((tile) => col(tile) === COLS - 1));
    expect(edge.length).toBeGreaterThan(100);
    expect(edge.every(isValidPath)).toBe(true);
  });

  it("covers every length from 8 to 12", () => {
    const lengths = new Set(paths.map((path) => path.length));
    expect([...lengths].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12]);
  });

  it("starts in every column", () => {
    expect(new Set(paths.map((path) => col(path[0]))).size).toBe(COLS);
  });

  it("gives the same path for the same seed", () => {
    expect(pathFor(42)).toEqual(pathFor(42));
    expect(pathFor(0xffff_ffff)).toEqual(pathFor(0xffff_ffff));
  });

  it("gives at least 90% distinct paths over 1 000 seeds", () => {
    const distinct = new Set(paths.slice(0, 1000).map((path) => path.join(",")));
    // Measured on the 5 x 8 board with the touch rule (T207): 988.
    expect(distinct.size).toBeGreaterThanOrEqual(900);
  });

  it("falls back to a fixed path that keeps every rule when no walk is tried", () => {
    const path = pathFor(7, 0);
    expect(path).toEqual(fallbackPath(col(pathFor(7)[0])));
    expect(isValidPath(path)).toBe(true);
  });
});

describe("fallbackPath", () => {
  it("is this hand-checked climb from each start column, keeping every rule", () => {
    expect(fallbackPath(0)).toEqual(at([0, 0], [1, 0], [2, 0], [3, 1], [4, 1], [5, 1], [6, 0], [7, 0]));
    expect(fallbackPath(4)).toEqual(at([0, 4], [1, 4], [2, 4], [3, 3], [4, 3], [5, 3], [6, 4], [7, 4]));
    for (let c = 0; c < COLS; c++) {
      const path = fallbackPath(c);
      expect(path[0]).toBe(c);
      expect(path).toHaveLength(8);
      expect(cutbacks(path)).toEqual([]);
      expect(isValidPath(path)).toBe(true);
    }
  });
});

describe("isValidPath", () => {
  // Up the board, alternating straight and diagonal steps: the shortest kind of path.
  const eight = at([0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3]);
  // A staircase of four sideways steps, then back left: the longest kind.
  const twelve = at([0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 4], [4, 4], [5, 3], [6, 3], [7, 4]);

  it("accepts hand-built paths of 8 and 12 tiles that keep the rules", () => {
    expect(isValidPath(eight)).toBe(true);
    expect(isValidPath(twelve)).toBe(true);
  });

  it("rejects a corner cut: forward, sideways, then diagonally back beside the first tile (T207)", () => {
    const cut = at([0, 1], [1, 1], [1, 2], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3]);
    expect(cutbacks(cut)).toEqual([[1, 3]]);
    expect(isValidPath(cut)).toBe(false);
  });

  it("rejects a row that doubles back alongside the one below it (T207)", () => {
    const alongside = at([0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4]);
    expect(cutbacks(alongside)).toEqual([[1, 4]]);
    expect(isValidPath(alongside)).toBe(false);
  });

  it("rejects three of the same move in a row", () => {
    expect(isValidPath(at([0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [5, 1], [6, 2], [7, 2]))).toBe(false);
  });

  it("rejects a revisit", () => {
    expect(isValidPath(at([0, 0], [0, 1], [0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3]))).toBe(false);
  });

  it("rejects a jump that is the next index but not an adjacent tile", () => {
    // From the right edge of row 0 to the left edge of row 1.
    expect(isValidPath(at([0, 4], [1, 0], [2, 0], [3, 1], [4, 1], [5, 2], [6, 2], [7, 3]))).toBe(false);
  });

  it("rejects a path of 13 tiles that otherwise keeps every rule", () => {
    const thirteen = at([0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [1, 4], [2, 4], [3, 3], [3, 2], [4, 2], [5, 2], [6, 3], [7, 3]);
    expect(thirteen).toHaveLength(13);
    expect(cutbacks(thirteen)).toEqual([]);
    expect(isValidPath(thirteen)).toBe(false);
  });

  it("rejects paths too short, off the board, not from the bottom, past the top, or not whole tiles", () => {
    expect(isValidPath(eight.slice(0, -1))).toBe(false);
    expect(isValidPath([...eight.slice(0, -1), COLS * ROWS])).toBe(false);
    expect(isValidPath([6, ...eight.slice(1)])).toBe(false);
    expect(isValidPath([...eight, eight.at(-1)! + 1])).toBe(false);
    expect(isValidPath([0.5, ...eight.slice(1)])).toBe(false);
  });
});
