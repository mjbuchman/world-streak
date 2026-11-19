import { describe, expect, it } from "vitest";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { createRng } from "../shared/prng";
import {
  BANK_POINTS,
  GAP_MS,
  LIMIT_MS,
  MISSED_COST,
  ROUNDS,
  ROUND_COUNTDOWN_MS,
  SHOW_MS,
  cutCost,
  fairSplit,
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
const squares: FairSplitParams = { bank: 8, shapes: Array.from({ length: ROUNDS }, () => ({ polygon: SQUARE, limitMs: LIMIT_MS })) };

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
const score = (cuts: FairSplitCut[], endMs?: number) => fairSplit.score(squares, runOf(cuts, endMs));

describe("Fair Split params (T193)", () => {
  it("documents the placeholders: 5 shapes, an 8-point bank (T211), 25 s each, the pieces then a 3-2-1 between shapes", () => {
    expect([ROUNDS, BANK_POINTS, LIMIT_MS, MISSED_COST]).toEqual([5, 8, 25_000, 50]);
    expect(ROUND_COUNTDOWN_MS).toBe(RUN_COUNTDOWN_MS);
    expect(GAP_MS).toBe(SHOW_MS + ROUND_COUNTDOWN_MS);
  });

  it("give every seed five shapes with the bank and the limit, the same every time", () => {
    for (let seed = 0; seed < 1000; seed += 7) {
      const p = paramsFromSeed(seed);
      expect(p.bank).toBe(BANK_POINTS);
      expect(p.shapes.map((s) => s.limitMs)).toEqual(Array<number>(ROUNDS).fill(LIMIT_MS));
      expect(p.shapes.every((s) => s.polygon.every(({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 100))).toBe(true);
      expect(paramsFromSeed(seed)).toEqual(p);
    }
    // Each shape is measured for symmetry as it is drawn (T210): slow under coverage.
  }, 60_000);

  it("differ per player: the first shape differs between at least 95% of 1 000 seeds", () => {
    const firsts = new Set(Array.from({ length: 1000 }, (_, seed) => JSON.stringify(paramsFromSeed(seed).shapes[0].polygon)));
    expect(firsts.size).toBeGreaterThanOrEqual(950);
  }, 60_000);

  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG or the shapes changes these)", (seed) => {
    const { shapes } = paramsFromSeed(seed);
    const round = ({ x, y }: Point) => ({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    expect({ points: shapes.map((s) => s.polygon.length), first: shapes[0].polygon.slice(0, 8).map(round) }).toMatchSnapshot();
  });
});

describe("Fair Split score (T193)", () => {
  it("prices a cut by its distance from half, to 0.01 point", () => {
    expect([cutCost(0.5), cutCost(0.49), cutCost(0.51), cutCost(0.12345), cutCost(1)]).toEqual([0, 1, 1, 37.66, 50]);
  });

  it("cuts at x = 50, 50.5, 49, 50, 51.5 score 5 + (8 - 3) / 8 = 5.625", () => {
    expect(score(cutsAt([50, 50.5, 49, 50, 51.5]))).toBe(5.625);
  });

  it("a cut at x = 40 (cost 10) scores 0", () => {
    expect(score(cutsAt([40]))).toBe(0);
    expect(play(squares, runOf(cutsAt([40])))).toMatchObject({ finished: true, failed: true, survived: 0, costs: [10] });
  });

  it("cuts at 54 and 54 spend exactly the bank and survive; a third perfect cut scores 3", () => {
    const run = runOf(cutsAt([54, 54, 50]));
    expect(play(squares, run)).toMatchObject({ survived: 3, left: 0, failed: false, finished: false, round: 3 });
    expect(fairSplit.score(squares, run)).toBe(3);
  });

  it("five perfect cuts score 6 and end the run", () => {
    const run = runOf(cutsAt([50, 50, 50, 50, 50]));
    expect(fairSplit.score(squares, run)).toBe(6);
    expect(play(squares, run)).toMatchObject({ finished: true, deadline: null, survived: 5, left: 8 });
  });

  it("endMs alone past the first limit scores 0; right at it the shape is still open", () => {
    const limit = ROUND_COUNTDOWN_MS + LIMIT_MS;
    expect(score([], limit + 1)).toBe(0);
    expect(play(squares, runOf([], limit + 1))).toMatchObject({ finished: true, last: { kind: "timeout", shape: 0, atMs: limit } });
    expect(play(squares, runOf([], limit))).toMatchObject({ finished: false, deadline: limit, costs: [] });
  });

  it("a cut right at the limit counts; one after it costs the whole bank", () => {
    expect(play(squares, runOf(cutsAt([50], LIMIT_MS)))).toMatchObject({ survived: 1, finished: false });
    expect(play(squares, runOf(cutsAt([50], LIMIT_MS + 1)))).toMatchObject({ survived: 0, failed: true, costs: [MISSED_COST], last: { kind: "timeout" } });
  });

  it("a line that misses the shape, or a cut with no length, busts the bank", () => {
    expect(score([{ atMs: ROUND_COUNTDOWN_MS + 500, ax: 0, ay: 0, bx: 100, by: 0 }])).toBe(0);
    expect(score([{ atMs: ROUND_COUNTDOWN_MS + 500, ax: 50, ay: 50, bx: 50, by: 50 }])).toBe(0);
  });

  it("times shape k at the last cut + GAP_MS, the first after one 3-2-1", () => {
    expect(play(squares, runOf([]))).toMatchObject({ round: 0, appearsAt: ROUND_COUNTDOWN_MS, deadline: ROUND_COUNTDOWN_MS + LIMIT_MS, last: null });
    const [first] = cutsAt([50], 2000);
    expect(first.atMs).toBe(ROUND_COUNTDOWN_MS + 2000);
    expect(play(squares, runOf([first]))).toMatchObject({ round: 1, appearsAt: first.atMs + GAP_MS });
  });

  it("ignores cuts in the 3-2-1, in the pause after a cut, and after the run has ended", () => {
    const early = { atMs: ROUND_COUNTDOWN_MS - 1, ax: 40, ay: 0, bx: 40, by: 100 };
    expect(play(squares, runOf([early]))).toMatchObject({ costs: [] });
    const [first] = cutsAt([50]);
    const inPause = { atMs: first.atMs + GAP_MS - 1, ax: 40, ay: 0, bx: 40, by: 100 };
    expect(play(squares, runOf([first, inPause]))).toMatchObject({ costs: [0] });
    const over = cutsAt([40]);
    const after = { atMs: over[0].atMs + GAP_MS + 1000, ax: 50, ay: 0, bx: 50, by: 100 };
    expect(play(squares, runOf([...over, after]))).toMatchObject({ costs: [10], survived: 0 });
  });

  it("reports the last cut's share, cost and whether it survived, for the game to show", () => {
    expect(play(squares, runOf(cutsAt([49.5]))).last).toMatchObject({ kind: "cut", shape: 0, share: expect.closeTo(0.495, 9), cost: 0.5, survived: true });
    expect(play(squares, runOf(cutsAt([50, 41]))).last).toMatchObject({ kind: "cut", shape: 1, cost: 9, survived: false });
  });

  it("is higher-better, between 0 and 6, and the same every time for the same cuts (property)", () => {
    expect(fairSplit.direction).toBe("higher-better");
    for (let seed = 0; seed < 50; seed++) {
      const p = paramsFromSeed(seed);
      const run = runOf(cutsAt([50, 49, 51, 45 + (seed % 10)], 800, p));
      const first = fairSplit.score(p, run);
      expect(fairSplit.score(p, run)).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(ROUNDS + 1);
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

/** The simulated cutter's aim: its line lands this far off the true half, in shape units (a standard deviation). */
const AIM_ERROR = 0.6;

/** A normally distributed number (Box-Muller), from the seeded RNG. */
const gaussian = (rng: ReturnType<typeof createRng>) => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

/** A cutter who picks a random direction, finds the true half and misses it by AIM_ERROR, 6 s into each shape. */
function simulatedRun(seed: number) {
  const params = paramsFromSeed(seed);
  const rng = createRng(seed);
  const cuts: FairSplitCut[] = [];
  for (;;) {
    const state = play(params, runOf(cuts));
    if (state.finished) return state;
    const angle = rng.next() * Math.PI;
    const c = halvingOffset(params.shapes[state.round].polygon, angle) + AIM_ERROR * gaussian(rng);
    const d = { x: Math.cos(angle), y: Math.sin(angle) };
    cuts.push({ atMs: state.appearsAt + 6000, ax: 50 - c * d.y, ay: 50 + c * d.x, bx: 50 - c * d.y + d.x, by: 50 + c * d.x + d.y });
  }
}

describe("Fair Split balance (T193)", () => {
  // T211: the owner's 8 point bank lets this cutter through 98.7% of the time (the 6 point bank: 50%
  // to 90%); the band is re-set from that run, so any later change to the shapes or bank shows here.
  it("a cutter off by 0.6 shape units (one standard deviation) survives all five shapes 95% to 99.5% of the time", () => {
    let survivedAll = 0;
    for (let seed = 0; seed < 1000; seed++) if (simulatedRun(seed).survived === ROUNDS) survivedAll++;
    expect(survivedAll / 1000).toBeGreaterThanOrEqual(0.95);
    expect(survivedAll / 1000).toBeLessThanOrEqual(0.995);
    // A thousand runs take several seconds under coverage.
  }, 60_000);
});

describe("Fair Split inputs (T193)", () => {
  const cut = (atMs: number, over: Partial<FairSplitCut> = {}) => ({ atMs, ax: 50, ay: 0, bx: 50, by: 100, ...over });

  it("accept up to five cuts in the box at rising times, ending no earlier than the last", () => {
    expect(fairSplit.inputsSchema.safeParse({ cuts: [cut(1), cut(2)], endMs: 2 }).success).toBe(true);
    expect(fairSplit.inputsSchema.safeParse({ cuts: [], endMs: 0 }).success).toBe(true);
    expect(fairSplit.inputsSchema.safeParse({ cuts: Array.from({ length: ROUNDS }, (_, i) => cut(i)), endMs: 99 }).success).toBe(true);
  });

  it.each([
    ["a point outside the box", { cuts: [cut(1, { ax: 100.5 })], endMs: 1 }],
    ["a negative coordinate", { cuts: [cut(1, { by: -1 })], endMs: 1 }],
    ["a negative time", { cuts: [cut(-1)], endMs: 1 }],
    ["times that do not rise", { cuts: [cut(5), cut(5)], endMs: 5 }],
    ["an end before the last cut", { cuts: [cut(5)], endMs: 4 }],
    ["no end", { cuts: [] }],
    ["an endless end", { cuts: [], endMs: Infinity }],
    ["more than five cuts", { cuts: Array.from({ length: ROUNDS + 1 }, (_, i) => cut(i)), endMs: 99 }],
  ])("reject %s", (_name, inputs) => {
    expect(fairSplit.inputsSchema.safeParse(inputs).success).toBe(false);
  });

  it("time the latest input at the end of the run, which holds every 3-2-1 and pause", () => {
    const cuts = cutsAt([50, 50]);
    expect(cuts[1].atMs).toBe(ROUND_COUNTDOWN_MS + 1000 + GAP_MS + 1000);
    expect(fairSplit.lastInputMs({ cuts, endMs: cuts[1].atMs }, squares)).toBe(cuts[1].atMs);
  });
});
