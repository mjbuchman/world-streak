import { afterEach, describe, expect, it, vi } from "vitest";
import { runFrames } from "./frameLoop";

/** A hand-driven requestAnimationFrame: `next()` runs the frame that is waiting. */
function fakeFrames() {
  let waiting: { id: number; callback: FrameRequestCallback } | null = null;
  let lastId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    waiting = { id: ++lastId, callback };
    return lastId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    if (waiting?.id === id) waiting = null;
  });
  return {
    next() {
      const frame = waiting;
      waiting = null;
      frame?.callback(0);
    },
    get pending() {
      return waiting !== null;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runFrames", () => {
  it("starts with the next frame and passes each frame's performance.now()", () => {
    const frames = fakeFrames();
    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(116);
    const step = vi.fn(() => true);
    runFrames(step);
    expect(step).not.toHaveBeenCalled();
    frames.next();
    frames.next();
    expect(step.mock.calls).toEqual([[100], [116]]);
    expect(frames.pending).toBe(true);
  });

  it("stops once the step returns false", () => {
    const frames = fakeFrames();
    const step = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    runFrames(step);
    frames.next();
    frames.next();
    expect(step).toHaveBeenCalledTimes(2);
    expect(frames.pending).toBe(false);
  });

  it("cancels the waiting frame, as on unmount", () => {
    const frames = fakeFrames();
    const step = vi.fn(() => true);
    const stop = runFrames(step);
    frames.next();
    stop();
    expect(frames.pending).toBe(false);
    frames.next();
    expect(step).toHaveBeenCalledTimes(1);
  });
});
