// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoundCountdown } from "./RoundCountdown";

let frames: FrameRequestCallback[] = [];
let now = 0;

/** Runs the waiting animation frame at `ms` after the first one. */
function frameAt(ms: number) {
  now = ms;
  const waiting = frames;
  frames = [];
  act(() => waiting.forEach((frame) => frame(now)));
}

const shown = () => document.querySelector("[data-countdown]")?.textContent ?? null;

beforeEach(() => {
  frames = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RoundCountdown", () => {
  it("counts 3, 2, 1 by elapsed time and calls onDone once, at 2400 ms", () => {
    const onDone = vi.fn();
    render(<RoundCountdown round={1} onDone={onDone} />);
    expect(screen.getByText("Round 2")).toBeTruthy();

    frameAt(0);
    expect(shown()).toBe("3");
    frameAt(800);
    expect(shown()).toBe("2");
    frameAt(1600);
    expect(shown()).toBe("1");
    frameAt(2399);
    expect(shown()).toBe("1");
    expect(onDone).not.toHaveBeenCalled();

    frameAt(2400);
    expect(shown()).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
    // The loop stopped, and the caption's slot stays so nothing jumps.
    expect(frames).toHaveLength(0);
    expect(screen.getByText("Round 2")).toBeTruthy();
  });

  it("with ms={0} calls onDone at once and renders nothing", () => {
    const onDone = vi.fn();
    const { container } = render(<RoundCountdown round={0} ms={0} onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe("");
    expect(frames).toHaveLength(0);
  });

  it("calls the newest onDone", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<RoundCountdown round={0} onDone={first} />);
    frameAt(0);
    rerender(<RoundCountdown round={0} onDone={second} />);
    frameAt(2400);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
