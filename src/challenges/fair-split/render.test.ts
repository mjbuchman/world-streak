import { describe, expect, it } from "vitest";
import {
  BOARD_MARGIN,
  SEPARATE_MS,
  SEPARATE_UNITS,
  boardLayout,
  drawFairSplit,
  lineThroughBox,
  percentLabel,
  separation,
  timerFraction,
  toCanvas,
  toShape,
  type FairSplitFrame,
} from "./render";

/** Records every call as [name, ...args], and every fill or stroke with the colour it used. */
function fakeContext() {
  const calls: unknown[][] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get: (target, name: string) =>
      name in target
        ? target[name]
        : (...args: unknown[]) => calls.push(name === "fill" || name === "stroke" || name === "fillRect" || name === "fillText" ? [name, name === "stroke" ? target.strokeStyle : target.fillStyle, ...args] : [name, ...args]),
    set: (target, name: string, value) => {
      target[name] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const colors = { board: "board", shape: "shape", left: "left", right: "right", line: "line", ring: "ring", track: "track", miss: "miss", text: "text" };
const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const frame = (over: Partial<FairSplitFrame> = {}): FairSplitFrame => ({
  width: 400,
  height: 400,
  devicePixelRatio: 2,
  polygon: SQUARE,
  drag: null,
  split: null,
  timer: null,
  miss: 0,
  colors,
  ...over,
});
const draw = (over: Partial<FairSplitFrame> = {}) => {
  const { ctx, calls } = fakeContext();
  drawFairSplit(ctx, frame(over));
  return calls;
};
const named = (calls: unknown[][], name: string) => calls.filter((call) => call[0] === name);

describe("Fair Split coordinates", () => {
  it("centre the box with a margin on any canvas", () => {
    expect(boardLayout(400, 400)).toEqual({ left: 400 * BOARD_MARGIN, top: 400 * BOARD_MARGIN, scale: (400 * (1 - 2 * BOARD_MARGIN)) / 100 });
    const wide = boardLayout(600, 400);
    expect(toCanvas(wide, { x: 50, y: 50 })).toEqual({ x: 300, y: 200 });
  });

  it("map a canvas point to shape space and back within 0.01 units, at any canvas size", () => {
    for (const [width, height] of [
      [390, 390],
      [1280, 720],
      [320, 568],
      [37, 911],
    ]) {
      const layout = boardLayout(width, height);
      for (const p of [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 33.3, y: 71.9 },
        { x: -5, y: 120 },
      ]) {
        const back = toShape(layout, toCanvas(layout, p));
        expect(Math.abs(back.x - p.x)).toBeLessThan(0.01);
        expect(Math.abs(back.y - p.y)).toBeLessThan(0.01);
      }
    }
  });

  it("clip a drag to the box along the same line, in the drag's direction", () => {
    expect(lineThroughBox({ x: 50, y: 40 }, { x: 50, y: 60 })).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
    expect(lineThroughBox({ x: 60, y: 30 }, { x: 40, y: 30 })).toEqual([
      { x: 100, y: 30 },
      { x: 0, y: 30 },
    ]);
    // A diagonal dragged from outside the box: y = x - 40 enters at (40, 0) and leaves at (100, 60).
    const [a, b] = lineThroughBox({ x: -10, y: -50 }, { x: 110, y: 70 }) ?? [];
    expect(a).toEqual({ x: 40, y: 0 });
    expect(b?.x).toBeCloseTo(100, 9);
    expect(b?.y).toBeCloseTo(60, 9);
  });

  it("give no cut for a line that misses the box or a drag with no length", () => {
    expect(lineThroughBox({ x: -10, y: 0 }, { x: -10, y: 100 })).toBeNull();
    expect(lineThroughBox({ x: 0, y: 120 }, { x: 100, y: 120 })).toBeNull();
    expect(lineThroughBox({ x: 150, y: 0 }, { x: 250, y: 100 })).toBeNull();
    expect(lineThroughBox({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });
});

describe("Fair Split timer and motion", () => {
  it("drains the ring from full to empty over the limit", () => {
    expect(timerFraction(0, 4000)).toBe(1);
    expect(timerFraction(1000, 4000)).toBe(0.75);
    expect(timerFraction(4000, 4000)).toBe(0);
    expect(timerFraction(5000, 4000)).toBe(0);
    expect(timerFraction(-100, 4000)).toBe(1);
  });

  it("moves the sides apart over SEPARATE_MS, or not at all under reduced motion", () => {
    expect(separation(0, false)).toBe(0);
    expect(separation(SEPARATE_MS / 2, false)).toBe(SEPARATE_UNITS / 2);
    expect(separation(SEPARATE_MS * 3, false)).toBe(SEPARATE_UNITS);
    expect(separation(SEPARATE_MS, true)).toBe(0);
  });

  it("labels shares to one decimal", () => {
    expect(percentLabel(0.4962)).toBe("49.6%");
    expect(percentLabel(0.5)).toBe("50.0%");
  });
});

describe("drawFairSplit", () => {
  it("draws the board, then the whole shape", () => {
    const calls = draw();
    expect(calls[0]).toEqual(["setTransform", 2, 0, 0, 2, 0, 0]);
    expect(named(calls, "fillRect")).toEqual([["fillRect", "board", 0, 0, 400, 400]]);
    expect(named(calls, "fill")).toEqual([["fill", "shape"]]);
    expect(named(calls, "stroke")).toEqual([]);
  });

  it("draws nothing but the board in the pause between shapes, and tints it after a miss", () => {
    const calls = draw({ polygon: null, miss: 0.5 });
    expect(named(calls, "fillRect").map((call) => call[1])).toEqual(["board", "miss"]);
    expect(named(calls, "fill")).toEqual([]);
  });

  it("draws the dragged line and the time ring", () => {
    const calls = draw({ drag: [{ x: 50, y: 0 }, { x: 50, y: 100 }], timer: 0.25 });
    expect(named(calls, "stroke").map((call) => call[1])).toEqual(["line", "track", "ring"]);
    const arcs = named(calls, "arc");
    expect(arcs[1].slice(4)).toEqual([-Math.PI / 2, -Math.PI / 2 + Math.PI / 2]);
  });

  it("draws the two sides of a cut with their percentages, moved apart", () => {
    const split = { a: { x: 40, y: 100 }, b: { x: 40, y: 0 }, share: 0.6, apart: 3 };
    const calls = draw({ split });
    expect(named(calls, "fill").map((call) => call[1])).toEqual(["left", "right"]);
    expect(named(calls, "fillText").map((call) => call[2])).toEqual(["60.0%", "40.0%"]);
    // The left side (x > 40 for a cut drawn upwards) moved 3 units right, the right side 3 left.
    const moves = named(calls, "moveTo");
    const layout = boardLayout(400, 400);
    expect(moves[0]).toEqual(["moveTo", ...Object.values(toCanvas(layout, { x: 43, y: 0 }))]);
    expect(moves[1]).toEqual(["moveTo", ...Object.values(toCanvas(layout, { x: -3, y: 0 }))]);
  });

  it("skips a side the cut left empty", () => {
    const split = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, share: 1, apart: 0 };
    expect(named(draw({ split }), "fillText").map((call) => call[2])).toEqual(["100.0%"]);
  });
});
