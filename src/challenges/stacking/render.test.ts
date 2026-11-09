import { describe, expect, it } from "vitest";
import { BASE_BLOCK, FIELD_WIDTH, blockLeftAt, simulate, type StackingParams } from "./engine";
import { BLOCK_HEIGHT, drawStacking, type StackingColors } from "./render";

const params: StackingParams = { startSpeed: 0.2, ramp: 0, direction: "right", maxDurationMs: 60_000 };
const colors: StackingColors = { background: "bg", base: "base", tower: "tower", moving: "moving" };

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

function draw(taps: number[], elapsedMs: number, { width = 200, height = 300, dpr = 1 } = {}) {
  const fake = fakeContext();
  drawStacking(fake.ctx, { params, result: simulate(params, taps), elapsedMs, colors, width, height, devicePixelRatio: dpr });
  return fake;
}

describe("drawStacking", () => {
  it("scales the 400-unit field to the canvas width, times the device pixel ratio", () => {
    expect(draw([], 0, { width: 200, height: 300, dpr: 1 }).transforms).toEqual([[0.5, 0, 0, 0.5, 0, 0]]);
    expect(draw([], 0, { width: 200, height: 300, dpr: 2 }).transforms).toEqual([[1, 0, 0, 1, 0, 0]]);
    expect(draw([], 0, { width: 800, height: 600, dpr: 3 }).transforms).toEqual([[6, 0, 0, 6, 0, 0]]);
  });

  it("clears the whole field before painting, so a translucent background never builds up", () => {
    // 200 x 300 CSS px at scale 0.5 is 400 x 600 units.
    const { calls } = draw([], 0);
    expect(calls[0]).toBe(`clear 0,0,${FIELD_WIDTH},600`);
    expect(calls[1]).toBe("fill bg");
  });

  it("paints the background over the whole field first", () => {
    // 200 x 300 CSS px at scale 0.5 is 400 x 600 units.
    expect(draw([], 0).rects[0]).toEqual({ fill: "bg", x: 0, y: 0, w: FIELD_WIDTH, h: 600 });
  });

  it("draws the base at the bottom, then the moving block one row above it", () => {
    const { rects } = draw([], 500);
    expect(rects.slice(1)).toEqual([
      { fill: "base", x: BASE_BLOCK.left, y: 600 - BLOCK_HEIGHT, w: BASE_BLOCK.width, h: BLOCK_HEIGHT },
      { fill: "moving", x: 100, y: 600 - 2 * BLOCK_HEIGHT, w: 200, h: BLOCK_HEIGHT },
    ]);
  });

  it("draws placed blocks at their trimmed size and the next block where the engine says", () => {
    const { rects } = draw([750], 1000);
    expect(rects[2]).toEqual({ fill: "tower", x: 150, y: 600 - 2 * BLOCK_HEIGHT, w: 150, h: BLOCK_HEIGHT });
    const moving = { index: 2, width: 150, startMs: 750 };
    expect(rects[3]).toEqual({
      fill: "moving",
      x: blockLeftAt(params, moving, 1000),
      y: 600 - 3 * BLOCK_HEIGHT,
      w: 150,
      h: BLOCK_HEIGHT,
    });
  });

  it("draws no moving block once the run has ended", () => {
    const { rects } = draw([750, 2000], 2500);
    expect(rects.map((rect) => rect.fill)).toEqual(["bg", "base", "tower"]);
  });

  it("scrolls up as the tower grows, keeping the moving block in view", () => {
    // 600 units fit 30 rows. Each block travels 100 units in 500 ms, so it lands exactly.
    const taps = Array.from({ length: 40 }, (_, i) => 500 * (i + 1));
    const { rects } = draw(taps, taps.at(-1)! + 100);
    const moving = rects.find((rect) => rect.fill === "moving")!;
    // Two free rows of headroom stay above the moving block.
    expect(moving.y).toBe(2 * BLOCK_HEIGHT);
    // The base has scrolled out of view, so it is not drawn.
    expect(rects.some((rect) => rect.fill === "base")).toBe(false);
    expect(rects.every((rect) => rect.y + rect.h > 0)).toBe(true);
  });
});
