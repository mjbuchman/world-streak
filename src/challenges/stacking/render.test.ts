import { describe, expect, it } from "vitest";
import { COLUMNS, ROWS, columnAt, simulate, type StackingParams } from "./engine";
import {
  BOUNCE_MS,
  CELL_GAP,
  CELL_RADIUS_PX,
  drawStacking,
  FALL_MS,
  fallingCells,
  landingLift,
  type StackingColors,
  TARGET_LINE,
} from "./render";

const params: StackingParams = { startStepMs: 100, stepDecayMs: 0, startColumn: 0, direction: "right" };
const colors: StackingColors = { empty: "empty", tower: "tower", moving: "moving", falling: "falling", target: "target" };

/** A drawn shape: `radius` is set for the rounded cells, absent for the plain target line. */
type Rect = { fill: string; alpha: number; x: number; y: number; w: number; h: number; radius?: number };

/** A stand-in for CanvasRenderingContext2D that records what is drawn. */
function fakeContext() {
  const rects: Rect[] = [];
  const transforms: number[][] = [];
  const calls: string[] = [];
  let path: Omit<Rect, "fill" | "alpha"> | null = null;
  const ctx = {
    fillStyle: "",
    globalAlpha: 1,
    setTransform: (...args: number[]) => transforms.push(args),
    clearRect: (x: number, y: number, w: number, h: number) => calls.push(`clear ${x},${y},${w},${h}`),
    fillRect: (x: number, y: number, w: number, h: number) => {
      calls.push(`fill ${ctx.fillStyle}`);
      rects.push({ fill: ctx.fillStyle, alpha: ctx.globalAlpha, x, y, w, h });
    },
    beginPath: () => (path = null),
    roundRect: (x: number, y: number, w: number, h: number, radius: number) => (path = { x, y, w, h, radius }),
    fill: () => {
      calls.push(`fill ${ctx.fillStyle}`);
      rects.push({ fill: ctx.fillStyle, alpha: ctx.globalAlpha, ...path! });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, transforms, calls };
}

type DrawOptions = { width?: number; height?: number; dpr?: number; passTarget?: number; reducedMotion?: boolean };

// 140 x 300 CSS px: 7 columns of 20 px, 15 rows of 20 px.
function draw(taps: number[], elapsedMs: number, { width = 140, height = 300, dpr = 1, ...rest }: DrawOptions = {}) {
  const fake = fakeContext();
  drawStacking(fake.ctx, {
    params,
    result: simulate(params, taps, elapsedMs),
    elapsedMs,
    colors,
    width,
    height,
    devicePixelRatio: dpr,
    ...rest,
  });
  return fake;
}

// Back from a drawn rectangle to its cell (rounded: removing the gap leaves float noise).
const cellsOf = (rects: Rect[], fill: string) =>
  rects
    .filter((rect) => rect.fill === fill)
    .map((rect) => ({ column: Math.round(rect.x - CELL_GAP / 2), row: Math.round(ROWS - (rect.y - CELL_GAP / 2)) }));

describe("drawStacking", () => {
  it("scales one cell to a seventh of the canvas width, times the device pixel ratio", () => {
    expect(draw([], 0, { width: 140, dpr: 1 }).transforms).toEqual([[20, 0, 0, 20, 0, 0]]);
    expect(draw([], 0, { width: 140, dpr: 2 }).transforms).toEqual([[40, 0, 0, 40, 0, 0]]);
  });

  it("clears the field first, then draws every empty cell of the board", () => {
    const { calls, rects } = draw([], 0);
    expect(calls[0]).toBe(`clear 0,0,${COLUMNS},${ROWS}`);
    expect(cellsOf(rects, "empty")).toHaveLength(COLUMNS * ROWS);
    expect(rects[0]).toEqual({
      fill: "empty",
      alpha: 1,
      x: CELL_GAP / 2,
      y: ROWS - 1 + CELL_GAP / 2,
      w: 1 - CELL_GAP,
      h: 1 - CELL_GAP,
      radius: CELL_RADIUS_PX / 20, // cells are 20 CSS px here
    });
  });

  it("rounds every cell by 8 CSS px, at most half a cell on a tiny board", () => {
    expect(new Set(draw([250, 350], 360).rects.filter((rect) => rect.fill !== "target").map((rect) => rect.radius))).toEqual(
      new Set([CELL_RADIUS_PX / 20]),
    );
    // 7 px wide: a cell is 1 px, so the radius stops at half the drawn cell.
    expect(draw([], 0, { width: 7, height: 15 }).rects[0].radius).toBeCloseTo((1 - CELL_GAP) / 2);
  });

  it("draws the moving row where the engine says, in row 1 at the start", () => {
    const { rects } = draw([], 250); // two steps in: columns 2-4
    expect(cellsOf(rects, "moving")).toEqual([
      { column: 2, row: 1 },
      { column: 3, row: 1 },
      { column: 4, row: 1 },
    ]);
  });

  it("draws locked rows in the tower colour, without the cells that fell off", () => {
    // Row 1 at 2-4; row 2 at 3-5 keeps 3-4.
    const { rects } = draw([250, 350], 360);
    expect(cellsOf(rects, "tower")).toEqual([
      { column: 2, row: 1 },
      { column: 3, row: 1 },
      { column: 4, row: 1 },
      { column: 3, row: 2 },
      { column: 4, row: 2 },
    ]);
    const row3 = simulate(params, [250, 350], 360).moving!;
    expect(cellsOf(rects, "moving")).toEqual([
      { column: columnAt(params, row3, 360), row: 3 },
      { column: columnAt(params, row3, 360) + 1, row: 3 },
    ]);
  });

  it("draws no moving row once the run has ended", () => {
    expect(cellsOf(draw([1, 2], 10).rects, "moving")).toEqual([]);
  });

  it("draws the target line along the top of the pass row, across the board, only when given", () => {
    const line = draw([], 0, { passTarget: 10 }).rects.filter((rect) => rect.fill === "target");
    expect(line).toEqual([
      { fill: "target", alpha: TARGET_LINE.alpha, x: 0, y: ROWS - 10 - TARGET_LINE.thickness / 2, w: COLUMNS, h: TARGET_LINE.thickness },
    ]);
    expect(draw([], 0).rects.some((rect) => rect.fill === "target")).toBe(false);
  });

  it("draws the cells that fell off as they fall, then nothing", () => {
    // Row 2 at 3-5 over row 1 at 2-4 loses column 5, locked at 350 ms.
    const falling = draw([250, 350], 350 + FALL_MS / 2).rects.filter((rect) => rect.fill === "falling");
    expect(falling).toHaveLength(1);
    expect(falling[0].x).toBeCloseTo(5 + CELL_GAP / 2);
    expect(falling[0].y).toBeGreaterThan(ROWS - 2 + CELL_GAP / 2); // below where it was
    expect(falling[0].alpha).toBeLessThan(1);
    expect(draw([250, 350], 350 + FALL_MS).rects.some((rect) => rect.fill === "falling")).toBe(false);
  });

  it("lifts the row that just landed for a moment, then settles it", () => {
    const rowTwo = (elapsedMs: number, reducedMotion = false) =>
      draw([250, 350], elapsedMs, { reducedMotion }).rects.filter((rect) => rect.fill === "tower").at(-1)!;
    const resting = ROWS - 2 + CELL_GAP / 2;
    expect(rowTwo(350 + BOUNCE_MS / 2).y).toBeLessThan(resting);
    // Only the row that landed lifts; row 1 stays put.
    const rowOne = draw([250, 350], 350 + BOUNCE_MS / 2).rects.filter((rect) => rect.fill === "tower").slice(0, 3);
    for (const rect of rowOne) expect(rect.y).toBeCloseTo(ROWS - 1 + CELL_GAP / 2);
    expect(rowTwo(350 + BOUNCE_MS).y).toBeCloseTo(resting);
    expect(rowTwo(350 + BOUNCE_MS / 2, true).y).toBeCloseTo(resting);
  });

  it("draws no falling cells under reduced motion, and leaves the alpha as it found it", () => {
    const { rects, ctx } = draw([250, 350], 350 + FALL_MS / 2, { reducedMotion: true });
    expect(rects.some((rect) => rect.fill === "falling")).toBe(false);
    expect(draw([250, 350], 350 + FALL_MS / 2).ctx.globalAlpha).toBe(1);
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe("fallingCells", () => {
  const result = simulate(params, [250, 350]);

  it("starts each lost cell where its row locked, at full opacity", () => {
    expect(fallingCells(result, 350)).toEqual([{ column: 5, row: 2, drop: 0, alpha: 1 }]);
  });

  it("is a quarter of the way down and half faded halfway through", () => {
    const [mid] = fallingCells(result, 350 + FALL_MS / 2);
    expect(mid.drop).toBeCloseTo(0.75); // 3 cells x (1/2)^2
    expect(mid.alpha).toBeCloseTo(0.5);
  });

  it("speeds up as it falls and fades out", () => {
    const [early] = fallingCells(result, 350 + FALL_MS / 4);
    const [late] = fallingCells(result, 350 + (FALL_MS * 3) / 4);
    expect(late.drop - early.drop).toBeGreaterThan(early.drop * 2);
    expect(late.alpha).toBeLessThan(early.alpha);
  });

  it("is empty before the lock and once the fall is over", () => {
    expect(fallingCells(simulate(params, [250, 350], 349), 349)).toEqual([]);
    expect(fallingCells(result, 350 + FALL_MS)).toEqual([]);
  });

  it("covers a whole missed row", () => {
    // Row 3 tapped at once lands at 0-1 over row 2's 3-4: both cells fall (row 2's lost cell
    // from 1 ms earlier is still falling too).
    const missed = simulate(params, [250, 350, 351]);
    expect(missed.endReason).toBe("miss");
    const rowThree = fallingCells(missed, 351).filter((cell) => cell.row === 3);
    expect(rowThree.map((cell) => [cell.column, cell.row])).toEqual([
      [0, 3],
      [1, 3],
    ]);
  });
});

describe("landingLift", () => {
  // As the game calls it: the state at that moment, with that moment's time.
  const liftAt = (elapsedMs: number) => landingLift(simulate(params, [250, 350], elapsedMs), elapsedMs);

  it("lifts the last tapped row, highest halfway through the bounce", () => {
    expect(liftAt(350)).toEqual({ row: 2, lift: 0 });
    const mid = liftAt(350 + BOUNCE_MS / 2)!;
    expect(mid.row).toBe(2);
    expect(mid.lift).toBeCloseTo(0.18); // the full lift, at the top of the half sine
    expect(mid.lift).toBeGreaterThan(liftAt(350 + BOUNCE_MS / 4)!.lift);
  });

  it("is null once settled, before anything has landed, and for a miss", () => {
    expect(liftAt(350 + BOUNCE_MS)).toBeNull();
    expect(landingLift(simulate(params, [], 100), 100)).toBeNull();
    // A miss locks a row of width 0: nothing landed, so nothing bounces.
    const missed = simulate(params, [250, 350, 351]);
    expect(missed.rows.at(-1)).toMatchObject({ width: 0 });
    expect(landingLift(missed, 351 + BOUNCE_MS / 2)).toBeNull();
  });
});
