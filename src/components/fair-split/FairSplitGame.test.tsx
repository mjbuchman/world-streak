// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAP_MS, ROUND_COUNTDOWN_MS, SHOW_MS, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";
import type { FairSplitFrame } from "@/challenges/fair-split/render";

// The drawing has its own tests; here each frame handed to it is kept, to see what the screen shows.
const drawn = vi.hoisted(() => ({ frames: [] as FairSplitFrame[] }));
vi.mock("@/challenges/fair-split/render", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/fair-split/render")>();
  return { ...real, drawFairSplit: (_ctx: unknown, frame: FairSplitFrame) => drawn.frames.push(frame) };
});

import { FairSplitGame } from "./FairSplitGame";

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const LIMIT = 5000;
const params: FairSplitParams = { bank: 6, shapes: [0, 1].map(() => ({ polygon: SQUARE, limitMs: LIMIT })) };
/** The game's first frame is at START; the first shape is up from APPEARS, its limit at DEADLINE. */
const START = 1000;
const APPEARS = START + ROUND_COUNTDOWN_MS;
const DEADLINE = APPEARS + LIMIT;

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  drawn.frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const ctx = new Proxy({} as Record<string, unknown>, { get: (target, name: string) => (name in target ? target[name] : () => undefined) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  // A 300 px board at the page's top left: the box starts 18 px in, at 2.64 px a unit. The first
  // line runs down x = 50 (150 px), from y = 18 px to 282 px, its middle at (150, 150).
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 300, height: 300 } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const UNIT = 2.64;

/** Runs the next animation frame at `now` ms (input handlers read the same clock). */
function frameAt(now: number) {
  vi.spyOn(performance, "now").mockReturnValue(now);
  const next = frames.shift();
  if (!next) throw new Error("No frame was requested");
  act(() => next(now));
}

const canvas = () => document.querySelector("canvas")!;
const phase = () => canvas().dataset.phase;
const cutButton = () => screen.getByRole<HTMLButtonElement>("button", { name: "Cut" });
const lastFrame = () => drawn.frames.at(-1)!;

/** Drags from one canvas point to another and lets go. */
function drag(from: [number, number], to: [number, number], button = 0) {
  fireEvent.pointerDown(canvas(), { button, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(canvas(), { clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(canvas(), { button, clientX: to[0], clientY: to[1] });
}
/** Slides the line sideways by `units`, by its middle. */
const slide = (units: number) => drag([150, 150], [150 + units * UNIT, 150]);

function startGame(onFinish = vi.fn<(inputs: FairSplitInputs) => void>()) {
  render(<FairSplitGame params={params} onFinish={onFinish} />);
  frameAt(START);
  frameAt(APPEARS);
  return onFinish;
}

describe("FairSplitGame", () => {
  it("counts 3-2-1 with a Round 1 caption before the first shape, with Cut off until it is up", () => {
    render(<FairSplitGame params={params} onFinish={vi.fn()} />);
    frameAt(START);
    expect(phase()).toBe("countdown");
    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(cutButton().disabled).toBe(true);
    expect(lastFrame().polygon).toBeNull();
    fireEvent.click(cutButton());
    frameAt(APPEARS - 1);
    expect(phase()).toBe("countdown");
    frameAt(APPEARS);
    expect(phase()).toBe("cut");
    expect(screen.queryByText("Round 1")).toBeNull();
    expect(cutButton().disabled).toBe(false);
    expect(lastFrame().line).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
    expect(lastFrame().timer).toBe(1);
  });

  it("moves the line by dragging its body and its ends, and never cuts on letting go", () => {
    const onFinish = startGame();
    slide(5);
    expect(lastFrameLine()).toEqual([
      { x: 55, y: 0 },
      { x: 55, y: 100 },
    ]);
    // The top handle, now at 55 units, dragged to the top right corner.
    drag([18 + 55 * UNIT, 18], [282, 18]);
    expect(lastFrameLine()).toEqual([
      { x: 100, y: 0 },
      { x: 55, y: 100 },
    ]);
    // Away from the line, or with another button, a drag moves nothing.
    drag([30, 250], [100, 250]);
    drag([18 + 55 * UNIT, 282], [18, 282], 2);
    expect(lastFrameLine()[1]).toEqual({ x: 55, y: 100 });
    expect(phase()).toBe("cut");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("cuts once with the Cut button, shows the pieces and the cost, then a 3-2-1 before shape 2", () => {
    startGame();
    slide(5);
    vi.spyOn(performance, "now").mockReturnValue(APPEARS + 2000);
    fireEvent.click(cutButton());
    fireEvent.click(cutButton());
    expect(phase()).toBe("result");
    expect(screen.getByText("55.0% and 45.0%. 5 points off half.")).toBeTruthy();
    expect(screen.getByText("1 point left of 6 points")).toBeTruthy();
    frameAt(APPEARS + 2000 + SHOW_MS - 1);
    expect(lastFrame().split!.share).toBeCloseTo(0.55, 9);
    expect(lastFrame().split!.apart).toBeGreaterThan(0);
    frameAt(APPEARS + 2000 + SHOW_MS);
    expect(phase()).toBe("countdown");
    expect(screen.getByText("Round 2")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Round 2 of 2" })).toBeTruthy();
    frameAt(APPEARS + 2000 + GAP_MS);
    expect(phase()).toBe("cut");
    // A fresh line for the new shape.
    expect(lastFrameLine()).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
  });

  it("cuts the line where it is at the time limit, timed at the limit itself", () => {
    const onFinish = startGame();
    slide(1);
    frameAt(DEADLINE + 400);
    expect(phase()).toBe("result");
    expect(screen.getByText("51.0% and 49.0%. 1 point off half.")).toBeTruthy();
    // Shape 2: no move at all, cut at its limit, right on half; the run ends after its pieces show.
    const secondDeadline = DEADLINE + GAP_MS + LIMIT;
    frameAt(DEADLINE + GAP_MS);
    frameAt(secondDeadline + 10);
    expect(screen.getByText("50.0% and 50.0%. Right on half.")).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
    frameAt(secondDeadline + SHOW_MS);
    expect(onFinish).toHaveBeenCalledOnce();
    const [{ cuts, endMs }] = onFinish.mock.calls[0];
    expect(cuts.map((cut) => cut.atMs)).toEqual([DEADLINE - START, secondDeadline - START]);
    expect(endMs).toBe(secondDeadline - START);
    expect(phase()).toBe("done");
  });

  it("ends the run when a cut is off by more than the bank holds, after its pieces show", () => {
    const onFinish = startGame();
    slide(6.5);
    fireEvent.click(cutButton());
    expect(screen.getByText("56.5% and 43.5%. 6.5 points off half. More than the bank had left.")).toBeTruthy();
    expect(screen.getByText("Bank used up")).toBeTruthy();
    expect(lastFrame().miss).toBe(0);
    frameAt(APPEARS + 100);
    expect(lastFrame().miss).toBeGreaterThan(0);
    frameAt(APPEARS + SHOW_MS);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ cuts: [expect.objectContaining({ atMs: ROUND_COUNTDOWN_MS })], endMs: ROUND_COUNTDOWN_MS });
    expect(phase()).toBe("done");
    expect(frames).toHaveLength(0);
  });

  it("slides the line with the arrow keys, turns it with [ and ], and cuts with Enter", () => {
    startGame();
    for (let i = 0; i < 4; i++) fireEvent.keyDown(canvas(), { key: "ArrowRight" });
    frameAt(APPEARS + 100);
    expect(lastFrame().line![0].x).toBeCloseTo(51, 9);
    fireEvent.keyDown(canvas(), { key: "]" });
    fireEvent.keyDown(canvas(), { key: "[" });
    fireEvent.keyDown(canvas(), { key: "x" });
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(screen.getByText("51.0% and 49.0%. 1 point off half.")).toBeTruthy();
  });

  it("keeps the pieces still with reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    startGame();
    fireEvent.click(cutButton());
    frameAt(APPEARS + SHOW_MS - 1);
    expect(lastFrame().split!.apart).toBe(0);
  });

  it("stops its frame loop when it leaves the screen", () => {
    const { unmount } = render(<FairSplitGame params={params} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});

/** The line the next frame will draw: runs one frame a moment after the last. */
function lastFrameLine() {
  const now = performance.now() + 1;
  frameAt(now);
  return lastFrame().line!.map(({ x, y }) => ({ x: Math.round(x * 1e6) / 1e6 + 0, y: Math.round(y * 1e6) / 1e6 + 0 }));
}
