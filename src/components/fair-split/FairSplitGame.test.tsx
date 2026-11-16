// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAP_MS, type FairSplitParams } from "@/challenges/fair-split/engine";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { FairSplitGame } from "./FairSplitGame";

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const LIMIT = 3000;
const params: FairSplitParams = { shapes: [0, 1].map(() => ({ polygon: SQUARE, limitMs: LIMIT })) };

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  // A context that takes any drawing call.
  const ctx = new Proxy({} as Record<string, unknown>, { get: (target, name: string) => (name in target ? target[name] : () => undefined) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  // A 300 px board at the page's top left: the box starts 18 px in, at 2.64 px a unit, so x = 50 is at 150 px.
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 300, height: 300 } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let clock = 0;
/** Runs the next animation frame at `now` ms (React reads the clock too, so the value holds). */
function frameAt(now: number) {
  clock = now;
  vi.spyOn(performance, "now").mockReturnValue(now);
  const next = frames.shift();
  if (!next) throw new Error("No frame was requested");
  act(() => next(now));
}

/** Drags from one canvas point to another at the current clock. */
function dragAt(from: [number, number], to: [number, number], button = 0) {
  vi.spyOn(performance, "now").mockReturnValue(clock);
  fireEvent.pointerDown(canvas(), { button, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(canvas(), { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2 });
  fireEvent.pointerUp(canvas(), { button, clientX: to[0], clientY: to[1] });
}
/** A vertical cut at canvas x (150 is the middle of the box). */
const cutAt = (x: number) => dragAt([x, 40], [x, 260]);

const canvas = () => document.querySelector("canvas")!;
const phase = () => canvas().dataset.phase;
const lives = () => screen.getByRole("img", { name: /lives left$/ }).getAttribute("aria-label");

describe("FairSplitGame", () => {
  it("counts 3-2-1, then shows the first shape, and ignores drags until then", () => {
    render(<FairSplitGame params={params} onFinish={vi.fn()} />);
    frameAt(1000);
    expect(phase()).toBe("countdown");
    cutAt(150);
    expect(screen.getByText("Shape 1 of 2 · cut 0")).toBeTruthy();
    frameAt(1000 + RUN_COUNTDOWN_MS);
    expect(phase()).toBe("cut");
    expect(canvas().getAttribute("aria-label")).toBe("Drag one straight cut across the shape.");  });

  it("shows a counted cut's split, then the next shape; a timeout costs a life", () => {
    const onFinish = vi.fn();
    render(<FairSplitGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(0);
    frameAt(1000);
    cutAt(150);
    expect(phase()).toBe("result");
    expect(screen.getByText("50.0% and 50.0%. Fair cut!")).toBeTruthy();
    expect(screen.getByText("Shape 2 of 2 · cut 1")).toBeTruthy();
    // A drag during the pause after the cut does nothing.
    cutAt(100);
    frameAt(1000 + GAP_MS - 1);
    expect(phase()).toBe("result");
    frameAt(1000 + GAP_MS);
    expect(phase()).toBe("cut");
    // The second shape appeared at 2200; nothing by its 3 s limit is a timeout.
    frameAt(1000 + GAP_MS + LIMIT + 1);
    expect(lives()).toBe("2 of 3 lives left");
    expect(screen.getByText("Time's up. You lose a life.")).toBeTruthy();
    expect(phase()).toBe("result");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("ignores short drags and other buttons, and costs a life for an unfair cut", () => {
    render(<FairSplitGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    frameAt(0);
    frameAt(500);
    dragAt([150, 40], [150, 60]);
    dragAt([150, 40], [150, 260], 2);
    fireEvent.pointerUp(canvas(), { clientX: 150, clientY: 260 });
    expect(phase()).toBe("cut");
    // x = 165 px is 55.7 units in: 55.7% on one side.
    cutAt(165);
    expect(lives()).toBe("2 of 3 lives left");
    expect(screen.getByText(/Not within 1 point of half: you lose a life\.$/)).toBeTruthy();
    expect(screen.getByText("Shape 1 of 2 · cut 0")).toBeTruthy();
  });

  it("reports the cuts and the end when the lives run out, timeouts included", () => {
    const onFinish = vi.fn();
    render(<FairSplitGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(100);
    frameAt(1100);
    cutAt(150);
    frameAt(30_100);
    expect(onFinish).toHaveBeenCalledOnce();
    const [{ cuts, endMs }] = onFinish.mock.calls[0];
    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toMatchObject({ atMs: 1000, ay: 0, by: 100 });
    expect(cuts[0].ax).toBeCloseTo(50, 9);
    expect(endMs).toBe(30_000);
    expect(phase()).toBe("done");
    expect(lives()).toBe("0 of 3 lives left");
  });

  it("reports the run when the last shape is cut", () => {
    const onFinish = vi.fn();
    render(<FairSplitGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(0);
    frameAt(500);
    cutAt(150);
    frameAt(500 + GAP_MS + 100);
    cutAt(150);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ endMs: 500 + GAP_MS + 100 }));
    expect(phase()).toBe("done");
    cutAt(150);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("stops its frame loop when it leaves the screen", () => {
    const { unmount } = render(<FairSplitGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
