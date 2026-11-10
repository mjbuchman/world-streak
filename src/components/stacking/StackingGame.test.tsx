// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_LOCK_MS, MAX_TAPS, ROWS, simulate, type StackingParams } from "@/challenges/stacking/engine";

const drawStacking = vi.hoisted(() => vi.fn());
vi.mock("@/challenges/stacking/render", () => ({ drawStacking }));

import { StackingGame } from "./StackingGame";

// Row 1 starts at columns 2-4 moving right, stepping every 160 ms (7 ms faster per row).
const params: StackingParams = { startStepMs: 160, stepDecayMs: 7, startColumn: 2, direction: "right" };

/** Long enough for idle locks to finish any run (every row locks by itself after 8 s). */
const UNTIL_THE_END = (ROWS + 1) * IDLE_LOCK_MS;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  // jsdom has no canvas; the renderer is mocked, so any object will do.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  drawStacking.mockReset();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const pressSpace = (init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key: " ", code: "Space", ...init });

describe("StackingGame", () => {
  it("records taps from Space and pointer presses as elapsed ms, and finishes with the engine's final result", () => {
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);

    advance(930);
    pressSpace();
    advance(782);
    fireEvent.pointerDown(screen.getByRole("img", { name: /tower/i }), { isPrimary: true });
    advance(865);
    pressSpace();
    expect(onFinish).not.toHaveBeenCalled();

    // The player stops; idle locks finish the run.
    advance(UNTIL_THE_END);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const { taps, result } = onFinish.mock.calls[0][0];
    expect(taps).toEqual([930, 1712, 2577]);
    // The same result the server gets by replaying the taps to the end.
    expect(result).toEqual(simulate(params, taps));
  });

  it("shows the row in play live", () => {
    render(<StackingGame params={params} onFinish={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Row 1");
    advance(900);
    pressSpace();
    advance(20);
    // Row 1 rests on the floor, so the first tap always counts.
    expect(screen.getByRole("status").textContent).toBe("Row 2");
  });

  it("shows today's target on /play, and draws its line", () => {
    render(<StackingGame params={params} onFinish={vi.fn()} passTarget={10} />);
    expect(screen.getByText("Row 10 to pass")).toBeTruthy();
    advance(20);
    expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ passTarget: 10 });
  });

  it("shows the best row of this visit in practice, once there is one", () => {
    const { rerender } = render(<StackingGame params={params} onFinish={vi.fn()} best={0} />);
    expect(screen.queryByText(/Best/)).toBeNull();
    rerender(<StackingGame params={params} onFinish={vi.fn()} best={7} />);
    expect(screen.getByText("Best: row 7")).toBeTruthy();
    expect(screen.queryByText(/to pass/)).toBeNull();
  });

  it("tells the renderer to skip the falling and bounce animations under reduced motion", () => {
    for (const reduced of [false, true]) {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)" ? reduced : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      render(<StackingGame params={params} onFinish={vi.fn()} />);
      advance(20);
      expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ reducedMotion: reduced });
      cleanup();
    }
  });

  it("finishes as soon as a row misses", () => {
    // Row 1 at 2-4; row 2 one step after appearing at the right wall keeps 3-4; row 3 tapped
    // as it appears at the left wall (0-1) misses (see stackingLoop.test.ts).
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);
    advance(1);
    pressSpace();
    advance(169);
    pressSpace();
    advance(1);
    pressSpace();
    advance(20);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].result).toMatchObject({ score: 2, endReason: "miss" });
  });

  it("draws every frame with the engine state for that moment", () => {
    render(<StackingGame params={params} onFinish={vi.fn()} />);
    advance(100);
    const frame = drawStacking.mock.calls.at(-1)![1];
    expect(frame.params).toBe(params);
    expect(frame.elapsedMs).toBeGreaterThan(80);
    expect(frame.result).toEqual(simulate(params, [], frame.elapsedMs));
  });

  it("ignores a held Space key and other keys", () => {
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);
    advance(400);
    pressSpace();
    advance(100);
    pressSpace({ repeat: true });
    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    advance(UNTIL_THE_END);
    expect(onFinish.mock.calls[0][0].taps).toEqual([400]);
  });

  it("records one tap when two inputs land at the same moment", () => {
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);
    advance(930);
    pressSpace();
    fireEvent.pointerDown(screen.getByRole("img", { name: /tower/i }), { isPrimary: true });
    advance(UNTIL_THE_END);
    expect(onFinish.mock.calls[0][0].taps).toEqual([930]);
  });

  it("ignores a second finger on the canvas", () => {
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);
    const canvas = screen.getByRole("img", { name: /tower/i });
    advance(930);
    fireEvent.pointerDown(canvas, { isPrimary: true });
    advance(5);
    fireEvent.pointerDown(canvas, { isPrimary: false });
    advance(UNTIL_THE_END);
    expect(onFinish.mock.calls[0][0].taps).toEqual([930]);
  });

  it(`never records more than ${MAX_TAPS} taps, even in a burst between two frames`, () => {
    // 20 taps half a millisecond apart all land before the first animation frame, so the run
    // has not noticed its end yet; the cap keeps the submission valid.
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);
    for (let i = 0; i < MAX_TAPS + 5; i++) {
      advance(0.5);
      pressSpace();
    }
    advance(UNTIL_THE_END);
    expect(onFinish.mock.calls[0][0].taps).toHaveLength(MAX_TAPS);
  });

  it("sizes the canvas backing store for the device pixel ratio", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 140, height: 300 } as DOMRect);
    vi.stubGlobal("devicePixelRatio", 2);
    render(<StackingGame params={params} onFinish={vi.fn()} />);
    advance(20);
    const canvas = screen.getByRole("img", { name: /tower/i }) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([280, 600]);
    expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ width: 140, height: 300, devicePixelRatio: 2 });
  });

  it("stops Space from scrolling the page", () => {
    render(<StackingGame params={params} onFinish={vi.fn()} />);
    // fireEvent returns false when the handler called preventDefault.
    expect(pressSpace()).toBe(false);
  });

  it("keeps the run going when the parent passes a new onFinish", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<StackingGame params={params} onFinish={first} />);
    advance(930);
    pressSpace();
    rerender(<StackingGame params={params} onFinish={second} />);
    advance(UNTIL_THE_END);
    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls[0][0].taps).toEqual([930]);
  });

  it("marks itself as a running game, so the page can hide its back button", () => {
    const { container } = render(<StackingGame params={params} onFinish={vi.fn()} />);
    expect(container.querySelector("[data-game-running]")).not.toBeNull();
  });

  it("takes keyboard focus when it starts, so focus is not lost when the Start button goes", () => {
    render(<StackingGame params={params} onFinish={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("img", { name: /tower/i }));
  });

  it("stops listening and drawing once unmounted", () => {
    const onFinish = vi.fn();
    const { unmount } = render(<StackingGame params={params} onFinish={onFinish} />);
    advance(100);
    unmount();
    const draws = drawStacking.mock.calls.length;
    pressSpace();
    advance(UNTIL_THE_END);
    expect(drawStacking.mock.calls.length).toBe(draws);
    expect(onFinish).not.toHaveBeenCalled();
  });
});
