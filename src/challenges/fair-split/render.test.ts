import { describe, expect, it } from "vitest";
import {
  BOARD_MARGIN,
  GRIP_RADIUS_PX,
  HANDLE_HIT_PX,
  HANDLE_RADIUS_PX,
  LINE_HIT_PX,
  NUDGE_UNITS,
  ROTATE_STEP,
  SEPARATE_MS,
  SEPARATE_UNITS,
  boardLayout,
  drawFairSplit,
  hitLine,
  initialLine,
  lineThroughBox,
  moveHandle,
  nudge,
  percentLabel,
  rotate,
  separation,
  timerFraction,
  toCanvas,
  toShape,
  translateLine,
  type FairSplitFrame,
  type Line,
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
  line: null,
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

/** Both ends of a line rounded to 1e-6, so float noise does not fail an exact match. */
const rounded = (line: Line) => line.map(({ x, y }) => ({ x: Math.round(x * 1e6) / 1e6 + 0, y: Math.round(y * 1e6) / 1e6 + 0 }));
const onEdge = ({ x, y }: { x: number; y: number }) => [x, y].some((v) => Math.abs(v) < 1e-9 || Math.abs(v - 100) < 1e-9);

describe("Fair Split line (T194)", () => {
  it("starts straight down through the centre", () => {
    expect(initialLine()).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
  });

  it("moves a handle and pivots on the other end, edge to edge, kept in the box", () => {
    expect(rounded(moveHandle(initialLine(), "a", { x: 100, y: 0 }))).toEqual([
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]);
    // A handle dragged outside the box stops at its corner.
    expect(rounded(moveHandle(initialLine(), "b", { x: -40, y: 140 }))).toEqual([
      { x: 50, y: 0 },
      { x: 0, y: 100 },
    ]);
    // Inside the box, the end runs on to the edge along the new line.
    expect(rounded(moveHandle(initialLine(), "b", { x: 75, y: 50 }))).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it("repairs a degenerate line (both ends equal) to the previous one", () => {
    const line = initialLine();
    expect(moveHandle(line, "a", { x: 50, y: 100 })).toBe(line);
    expect(moveHandle(line, "b", { x: 50, y: 0 })).toBe(line);
  });

  it("slides the line, its middle kept in the box at the edges", () => {
    expect(rounded(translateLine(initialLine(), { x: 10, y: 0 }))).toEqual([
      { x: 60, y: 0 },
      { x: 60, y: 100 },
    ]);
    expect(rounded(translateLine(initialLine(), { x: 500, y: 0 }))).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    // A diagonal slid into the corner would only touch the box there: the line stays where it was.
    const antiDiagonal: Line = [
      { x: 0, y: 100 },
      { x: 100, y: 0 },
    ];
    expect(translateLine(antiDiagonal, { x: 500, y: 500 })).toBe(antiDiagonal);
  });

  it("turns about its middle, and the keys slide and turn it", () => {
    const quarter = rotate(initialLine(), Math.PI / 2);
    expect(rounded(quarter)).toEqual([
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ]);
    expect(rounded(nudge(initialLine(), "ArrowRight")!)).toEqual(rounded(translateLine(initialLine(), { x: NUDGE_UNITS, y: 0 })));
    expect(rounded(nudge(initialLine(), "ArrowLeft")!)[0].x).toBe(50 - NUDGE_UNITS);
    expect(rounded(nudge(quarter, "ArrowUp")!)[0].y).toBe(50 - NUDGE_UNITS);
    expect(rounded(nudge(quarter, "ArrowDown")!)[0].y).toBe(50 + NUDGE_UNITS);
    expect(rounded(nudge(initialLine(), "]")!)).toEqual(rounded(rotate(initialLine(), ROTATE_STEP)));
    expect(rounded(nudge(initialLine(), "[")!)).toEqual(rounded(rotate(initialLine(), -ROTATE_STEP)));
    expect(nudge(initialLine(), "x")).toBeNull();
  });

  it("keeps both ends on the box's edge after any move", () => {
    let line = initialLine();
    const moves = [
      (l: Line) => rotate(l, 0.7),
      (l: Line) => translateLine(l, { x: -30, y: 12 }),
      (l: Line) => moveHandle(l, "a", { x: 3, y: 97 }),
      (l: Line) => rotate(l, -2.1),
      (l: Line) => translateLine(l, { x: 80, y: -80 }),
    ];
    for (const move of moves) {
      line = move(line);
      expect(line.every(onEdge)).toBe(true);
    }
  });

  it("takes a handle within 22 px first (the nearer one), then the line's body, else nothing", () => {
    const layout = boardLayout(400, 400);
    const line = initialLine();
    const [top, bottom] = line.map((p) => toCanvas(layout, p));
    const middle = toCanvas(layout, { x: 50, y: 50 });
    expect(hitLine(layout, line, top.x + HANDLE_HIT_PX, top.y)).toBe("a");
    expect(hitLine(layout, line, bottom.x, bottom.y - 10)).toBe("b");
    // Just beside the top handle's reach, along the line: the body.
    expect(hitLine(layout, line, top.x, top.y + HANDLE_HIT_PX + 1)).toBe("body");
    expect(hitLine(layout, line, middle.x + LINE_HIT_PX, middle.y)).toBe("body");
    expect(hitLine(layout, line, middle.x + LINE_HIT_PX + 1, middle.y)).toBeNull();
    // A short line: both handles in reach, the nearer one wins over the body.
    const short: Line = [
      { x: 50, y: 0 },
      { x: 52, y: 0 },
    ];
    const [s0, s1] = short.map((p) => toCanvas(layout, p));
    expect(hitLine(layout, short, s0.x + 1, s0.y)).toBe("a");
    expect(hitLine(layout, short, s1.x - 1, s1.y)).toBe("b");
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

  it("draws the line with a handle at each end and a grip in the middle, then the time ring, and no share", () => {
    const calls = draw({ line: initialLine(), timer: 0.25 });
    const layout = boardLayout(400, 400);
    expect(named(calls, "stroke").map((call) => call[1])).toEqual(["line", "line", "track", "ring"]);
    expect(named(calls, "fill").map((call) => call[1])).toEqual(["shape", "line", "line", "board"]);
    const arcs = named(calls, "arc");
    expect(arcs.slice(0, 3)).toEqual([
      ["arc", ...Object.values(toCanvas(layout, { x: 50, y: 0 })), HANDLE_RADIUS_PX, 0, 2 * Math.PI],
      ["arc", ...Object.values(toCanvas(layout, { x: 50, y: 100 })), HANDLE_RADIUS_PX, 0, 2 * Math.PI],
      ["arc", ...Object.values(toCanvas(layout, { x: 50, y: 50 })), GRIP_RADIUS_PX, 0, 2 * Math.PI],
    ]);
    expect(arcs[4].slice(4)).toEqual([-Math.PI / 2, -Math.PI / 2 + Math.PI / 2]);
    expect(named(calls, "fillText")).toEqual([]);
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
