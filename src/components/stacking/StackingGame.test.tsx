// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simulate, type StackingParams } from "@/challenges/stacking/engine";

const drawStacking = vi.hoisted(() => vi.fn());
vi.mock("@/challenges/stacking/render", () => ({ drawStacking }));

import { StackingGame } from "./StackingGame";

const params: StackingParams = { startSpeed: 0.11, ramp: 0.0025, direction: "right", maxDurationMs: 60_000 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  // jsdom has no canvas; the renderer is mocked, so any object will do.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  drawStacking.mockReset();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const pressSpace = (init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key: " ", code: "Space", ...init });

describe("StackingGame", () => {
  it("records taps from Space and pointer presses as elapsed ms, and finishes at the time limit", () => {
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);

    advance(930);
    pressSpace();
    advance(782);
    fireEvent.pointerDown(screen.getByRole("img", { name: /tower/i }));
    advance(865);
    pressSpace();
    expect(onFinish).not.toHaveBeenCalled();

    advance(60_000);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const { taps, result } = onFinish.mock.calls[0][0];
    expect(taps).toEqual([930, 1712, 2577]);
    // These taps stack (see stackingLoop.test.ts), so the run lasts until the time limit.
    expect(result).toMatchObject({ score: simulate(params, taps).score, endReason: "time", endedAtMs: 60_000 });
  });

  it("shows the block count live", () => {
    render(<StackingGame params={params} onFinish={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Blocks: 0");
    advance(900);
    pressSpace();
    advance(20);
    expect(screen.getByRole("status").textContent).toBe(`Blocks: ${simulate(params, [900]).score}`);
  });

  it("finishes as soon as a block misses", () => {
    const steady = { ...params, startSpeed: 0.2, ramp: 0 };
    const onFinish = vi.fn();
    render(<StackingGame params={steady} onFinish={onFinish} />);
    advance(750);
    pressSpace();
    advance(1250);
    pressSpace();
    advance(20);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].result).toMatchObject({ score: 1, endReason: "miss" });
  });

  it("draws every frame with the engine state for that moment", () => {
    render(<StackingGame params={params} onFinish={vi.fn()} />);
    advance(100);
    const frame = drawStacking.mock.calls.at(-1)![1];
    expect(frame.params).toBe(params);
    expect(frame.elapsedMs).toBeGreaterThan(80);
    expect(frame.result.score).toBe(0);
  });

  it("ignores a held Space key and other keys", () => {
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);
    advance(400);
    pressSpace();
    advance(100);
    pressSpace({ repeat: true });
    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    advance(60_000);
    expect(onFinish.mock.calls[0][0].taps).toEqual([400]);
  });

  it("stops listening and drawing once unmounted", () => {
    const onFinish = vi.fn();
    const { unmount } = render(<StackingGame params={params} onFinish={onFinish} />);
    advance(100);
    unmount();
    const draws = drawStacking.mock.calls.length;
    pressSpace();
    advance(61_000);
    expect(drawStacking.mock.calls.length).toBe(draws);
    expect(onFinish).not.toHaveBeenCalled();
  });
});
