import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import {
  GAP_MS,
  LIMIT_MS,
  LIVES,
  MAX_CUTS,
  MAX_SHAPES,
  TOLERANCE_POINTS,
  fairSplit,
  limitFor,
  oddnessFor,
  paramsFromSeed,
  play,
  type FairSplitCut,
  type FairSplitParams,
} from "./engine";
import { splitShare, type Point } from "./geometry";

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const LIMIT = 5000;
const squares: FairSplitParams = { shapes: Array.from({ length: MAX_SHAPES }, () => ({ polygon: SQUARE, limitMs: LIMIT })) };

/** A vertical cut at x, `afterMs` after the shape on screen appeared (each cut follows the last). */
function cutsAt(xs: number[], afterMs = 1000, params = squares): FairSplitCut[] {
  const cuts: FairSplitCut[] = [];
  for (const x of xs) {
    const { appearsAt } = play(params, { cuts, endMs: cuts.at(-1)?.atMs ?? 0 });
    cuts.push({ atMs: appearsAt + afterMs, ax: x, ay: 0, bx: x, by: 100 });
  }
  return cuts;
}
const runOf = (cuts: FairSplitCut[], endMs = cuts.at(-1)?.atMs ?? 0) => ({ cuts, endMs });

describe("Fair Split params", () => {
  it("documents the placeholders: 3 lives, 1 point either side, 12 shapes, limits from 7 s down to 4 s", () => {
    expect([LIVES, TOLERANCE_POINTS, MAX_SHAPES]).toEqual([3, 1, 12]);
    expect(Array.from({ length: MAX_SHAPES }, (_, k) => limitFor(k))).toEqual([7000, 6700, 6400, 6100, 5800, 5500, 5200, 4900, 4600, 4300, 4000, 4000]);
    expect(LIMIT_MS.min).toBe(4000);
    expect([0, 1, 4, 7, 11].map(oddnessFor)).toEqual([0, 0, 0.5, 1, 1]);
  });

  it("give every seed 0 to 999 twelve shapes in the box with falling limits, the same every time", () => {
    for (let seed = 0; seed < 1000; seed += 7) {
      const p = paramsFromSeed(seed);
      expect(p.shapes).toHaveLength(MAX_SHAPES);
      expect(p.shapes.map((s) => s.limitMs)).toEqual(Array.from({ length: MAX_SHAPES }, (_, k) => limitFor(k)));
      expect(p.shapes.every((s) => s.polygon.every(({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 100))).toBe(true);
      expect(paramsFromSeed(seed)).toEqual(p);
    }
    expect(paramsFromSeed(1)).not.toEqual(paramsFromSeed(2));
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG or the shapes changes these)", (seed) => {
    const { shapes } = paramsFromSeed(seed);
    const round = ({ x, y }: Point) => ({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    expect({ corners: shapes.map((s) => s.polygon.length), first: shapes[0].polygon.map(round) }).toMatchSnapshot();
  });
});

describe("Fair Split score", () => {
  it("cuts at x = 50, 50.9, 48.5, 50, 47, 53 score 3", () => {
    expect(fairSplit.score(squares, runOf(cutsAt([50, 50.9, 48.5, 50, 47, 53])))).toBe(3);
  });

  it("a cut at 51.0 or 49.0 counts; 51.1 and 48.9 do not", () => {
    expect(play(squares, runOf(cutsAt([51, 49])))).toMatchObject({ shape: 2, lives: 3 });
    expect(play(squares, runOf(cutsAt([51.1, 48.9])))).toMatchObject({ shape: 0, lives: 1 });
  });

  it("a cut after the limit costs a life, and is not used on the next shape while it is still to appear", () => {
    const late = cutsAt([50], LIMIT + 1);
    expect(play(squares, runOf(late))).toMatchObject({ shape: 0, lives: 2, appearsAt: LIMIT + GAP_MS, last: { kind: "timeout", atMs: LIMIT } });
    // A cut right at the limit still counts.
    expect(play(squares, runOf(cutsAt([50], LIMIT)))).toMatchObject({ shape: 1, lives: 3 });
  });

  it("a cut after the limit, once the shape is back, is judged on it", () => {
    const cut = { atMs: LIMIT + GAP_MS + 500, ax: 50, ay: 0, bx: 50, by: 100 };
    expect(play(squares, runOf([cut]))).toMatchObject({ shape: 1, lives: 2, last: { kind: "cut", counted: true, shape: 0 } });
  });

  it("three timeouts with endMs alone score 0", () => {
    const run = { cuts: [], endMs: 3 * (LIMIT + GAP_MS) };
    expect(fairSplit.score(squares, run)).toBe(0);
    expect(fairSplit.finished(squares, run)).toBe(true);
    // Just past the second limit, two have timed out; right at it, only one.
    expect(play(squares, { cuts: [], endMs: 2 * LIMIT + GAP_MS + 1 })).toMatchObject({ lives: 1, finished: false });
    expect(play(squares, { cuts: [], endMs: 2 * LIMIT + GAP_MS })).toMatchObject({ lives: 2 });
  });

  it("all twelve shapes cut with 2 lives scores 12 + 2/3", () => {
    const xs = [50, 50, 50, 60, ...Array<number>(MAX_SHAPES - 3).fill(50)];
    expect(fairSplit.score(squares, runOf(cutsAt(xs)))).toBe(12.667);
  });

  it("a line that misses the shape, or a cut with no length, costs a life", () => {
    const outside = { atMs: 1000, ax: 0, ay: 0, bx: 100, by: 0 };
    const point = { atMs: 3000, ax: 50, ay: 50, bx: 50, by: 50 };
    expect(play(squares, runOf([outside, point]))).toMatchObject({ shape: 0, lives: 1 });
  });

  it("ignores cuts in the pause before a shape and after the run has ended", () => {
    const early = { atMs: 1000 + GAP_MS / 2, ax: 50, ay: 0, bx: 50, by: 100 };
    const [first] = cutsAt([50]);
    expect(play(squares, runOf([first, early]))).toMatchObject({ shape: 1, lives: 3 });
    const over = cutsAt([40, 40, 40]);
    const after = { atMs: over[2].atMs + 5000, ax: 50, ay: 0, bx: 50, by: 100 };
    expect(fairSplit.score(squares, runOf([...over, after]))).toBe(0);
  });

  it("reports the last cut's share and whether it counted, for the game to show", () => {
    expect(play(squares, runOf([]))).toEqual({ shape: 0, lives: 3, appearsAt: 0, deadline: LIMIT, last: null, finished: false });
    expect(play(squares, runOf(cutsAt([49.5]))).last).toMatchObject({ kind: "cut", shape: 0, share: expect.closeTo(0.495, 9), counted: true });
    expect(play(squares, runOf(cutsAt(Array<number>(MAX_SHAPES).fill(50))))).toMatchObject({ finished: true, deadline: null });
  });

  it("is higher-better and the same every time for the same cuts (property)", () => {
    expect(fairSplit.direction).toBe("higher-better");
    for (let seed = 0; seed < 50; seed++) {
      const p = paramsFromSeed(seed);
      const run = runOf(cutsAt([50, 30, 50, 45 + (seed % 10)], 800, p));
      const first = fairSplit.score(p, run);
      expect(fairSplit.score(p, run)).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(MAX_SHAPES + 1);
    }
  });
});

/** The offset along the normal that halves the shape for a cut in direction `angle` (bisection). */
function halvingOffset(polygon: readonly Point[], angle: number): number {
  const d = { x: Math.cos(angle), y: Math.sin(angle) };
  const at = (c: number) => splitShare(polygon, { x: 50 - c * d.y, y: 50 + c * d.x }, { x: 50 - c * d.y + d.x, y: 50 + c * d.x + d.y });
  let lo = -60;
  let hi = 60;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Aim error of the simulated cutter: its line lands up to this many shape units off the true half, uniformly. */
const AIM_ERROR = 1;

/** A cutter who picks a random direction, finds the true half and misses it by up to AIM_ERROR, 1.5 s into each shape. */
function simulatedRun(seed: number) {
  const params = paramsFromSeed(seed);
  const rng = createRng(seed);
  const cuts: FairSplitCut[] = [];
  for (;;) {
    const state = play(params, runOf(cuts));
    if (state.finished) return fairSplit.score(params, runOf(cuts));
    const angle = rng.next() * Math.PI;
    const c = halvingOffset(params.shapes[state.shape].polygon, angle) + (rng.next() * 2 - 1) * AIM_ERROR;
    const d = { x: Math.cos(angle), y: Math.sin(angle) };
    cuts.push({ atMs: state.appearsAt + 1500, ax: 50 - c * d.y, ay: 50 + c * d.x, bx: 50 - c * d.y + d.x, by: 50 + c * d.x + d.y });
  }
}

describe("Fair Split balance", () => {
  it("a cutter with a documented aim error survives about 6 shapes on average", () => {
    let total = 0;
    for (let seed = 0; seed < 200; seed++) total += Math.floor(simulatedRun(seed));
    expect(total / 200).toBeGreaterThan(4.5);
    expect(total / 200).toBeLessThan(7.5);
  });
});

describe("Fair Split inputs", () => {
  const cut = (atMs: number, over: Partial<FairSplitCut> = {}) => ({ atMs, ax: 50, ay: 0, bx: 50, by: 100, ...over });

  it("accept cuts in the box at rising times, up to MAX_CUTS, ending no earlier than the last", () => {
    expect(fairSplit.inputsSchema.safeParse({ cuts: [cut(1), cut(2)], endMs: 2 }).success).toBe(true);
    expect(fairSplit.inputsSchema.safeParse({ cuts: [], endMs: 0 }).success).toBe(true);
    expect(fairSplit.inputsSchema.safeParse({ cuts: Array.from({ length: MAX_CUTS }, (_, i) => cut(i)), endMs: 99 }).success).toBe(true);
    expect(MAX_CUTS).toBe(MAX_SHAPES + LIVES - 1);
  });

  it.each([
    ["a point outside the box", { cuts: [cut(1, { ax: 100.5 })], endMs: 1 }],
    ["a negative coordinate", { cuts: [cut(1, { by: -1 })], endMs: 1 }],
    ["a negative time", { cuts: [cut(-1)], endMs: 1 }],
    ["times that do not rise", { cuts: [cut(5), cut(5)], endMs: 5 }],
    ["an end before the last cut", { cuts: [cut(5)], endMs: 4 }],
    ["no end", { cuts: [] }],
    ["an endless end", { cuts: [], endMs: Infinity }],
    ["more cuts than MAX_CUTS", { cuts: Array.from({ length: MAX_CUTS + 1 }, (_, i) => cut(i)), endMs: 99 }],
  ])("reject %s", (_name, inputs) => {
    expect(fairSplit.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("time the latest input at the end of the run", () => {
    expect(fairSplit.lastInputMs({ cuts: [cut(5)], endMs: 9000 }, squares)).toBe(9000);
  });
});
