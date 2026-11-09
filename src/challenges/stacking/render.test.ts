import { describe, expect, it } from "vitest";
import { COLUMNS, ROWS, columnAt, simulate, type StackingParams } from "./engine";
import { CELL_GAP, drawStacking, type StackingColors } from "./render";

const params: StackingParams = { startStepMs: 100, stepDecayMs: 0, startColumn: 0, direction: "right" };
const colors: StackingColors = { empty: "empty", tower: "tower", moving: "moving" };

type Rect = { fill: string; x: number; y: number; w: number; h: number };

/** A stand-in for CanvasRenderingContext2D that records what is drawn. */
function fakeContext() {
  const rects: Rect[] = [];
  const transforms: number[][] = [];
  const calls: string[] = [];
  const ctx = {
    fillStyle: "",
    setTransform: (...args: number[]) => transforms.push(args),
    clearRect: (x: number, y: number, w: number, h: number) => calls.push(`clear ${x},${y},${w},${h}`),
    fillRect: (x: number, y: number, w: number, h: number) => {
      calls.push(`fill ${ctx.fillStyle}`);
      rects.push({ fill: ctx.fillStyle, x, y, w, h });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, transforms, calls };
}

// 140 x 300 CSS px: 7 columns of 20 px, 15 rows of 20 px.
function draw(taps: number[], elapsedMs: number, { width = 140, height = 300, dpr = 1 } = {}) {
  const fake = fakeContext();
  drawStacking(fake.ctx, { params, result: simulate(params, taps, elapsedMs), elapsedMs, colors, width, height, devicePixelRatio: dpr });
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
    expect(rects[0]).toEqual({ fill: "empty", x: CELL_GAP / 2, y: ROWS - 1 + CELL_GAP / 2, w: 1 - CELL_GAP, h: 1 - CELL_GAP });
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
});
