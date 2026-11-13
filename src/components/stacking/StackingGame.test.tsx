// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TAPS, simulate, type StackingParams } from "@/challenges/stacking/engine";
import { simulatedTaps, tapsForAMiss } from "@/challenges/stacking/player";
import { FALL_MS } from "@/challenges/stacking/render";
import { COUNTDOWN_STEP_MS, RUN_COUNTDOWN_MS } from "@/config/countdown";

const drawStacking = vi.hoisted(() => vi.fn());
// Only the drawing is replaced; the real constants (FALL_MS) stay.
vi.mock("@/challenges/stacking/render", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/challenges/stacking/render")>()),
  drawStacking,
}));

import { StackingGame } from "./StackingGame";

// Row 1 starts at columns 2-4 moving right, stepping every 160 ms (7 ms faster per row).
const params: StackingParams = { startStepMs: 160, stepDecayMs: 7, startColumn: 2, direction: "right" };

/** Ms advanced since the test began; each test renders its game at 0. */
let elapsed = 0;

beforeEach(() => {
  elapsed = 0;
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

const advance = (ms: number) => {
  elapsed += ms;
  act(() => vi.advanceTimersByTime(ms));
};
const pressSpace = (init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key: " ", code: "Space", ...init });

/**
 * Ends the run (there is no time limit, so it never ends by itself): after `taps` (the taps
 * counted so far) it taps a deliberate miss worked out with the engine, then lets the last
 * fall play out. Returns every tap the game should report.
 */
function missAndFinish(taps: number[]): number[] {
  const all = tapsForAMiss(params, taps, Math.ceil(elapsed) + 1);
  for (const tap of all.slice(taps.length)) {
    advance(tap - elapsed);
    pressSpace();
  }
  advance(FALL_MS + 50);
  return all;
}

describe("StackingGame", () => {
  it("counts 3-2-1 over the still board first, ignores taps during it, and times taps from right after it (T138)", () => {
    const onFinish = vi.fn();
    render(<StackingGame params={params} onFinish={onFinish} />);
    const countdown = () => document.querySelector("[data-countdown]")?.textContent;
    // Already before the first frame.
    expect(countdown()).toBe("3");
    advance(20);
    expect(countdown()).toBe("3");
    expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ elapsedMs: 0 });
    pressSpace();
    advance(COUNTDOWN_STEP_MS);
    expect(countdown()).toBe("2");
    advance(COUNTDOWN_STEP_MS);
    expect(countdown()).toBe("1");
    pressSpace();
    advance(RUN_COUNTDOWN_MS - elapsed);
    expect(countdown()).toBeUndefined();
    expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ elapsedMs: 0 });

    // The run's 0 ms is the end of the countdown: a tap 930 ms later is recorded as 930.
    advance(930);
    pressSpace();
    const all = tapsForAMiss(params, [930], 931);
    for (const tap of all.slice(1)) {
      advance(RUN_COUNTDOWN_MS + tap - elapsed);
      pressSpace();
    }
    advance(FALL_MS + 50);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].taps).toEqual(all);
  });

  it("records taps from Space and pointer presses as elapsed ms, and finishes with the engine's final result", () => {
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);

    advance(930);
    pressSpace();
    advance(782);
    fireEvent.pointerDown(screen.getByRole("img", { name: /tower/i }), { isPrimary: true });
    advance(865);
    pressSpace();
    expect(onFinish).not.toHaveBeenCalled();

    // Nothing ends the run until a tap does: no time limit.
    advance(60_000);
    expect(onFinish).not.toHaveBeenCalled();
    const expected = missAndFinish([930, 1712, 2577]);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const { taps, result } = onFinish.mock.calls[0][0];
    expect(taps).toEqual(expected);
    expect(taps.slice(0, 3)).toEqual([930, 1712, 2577]);
    // The same result the server gets by replaying the taps to the end.
    expect(result).toEqual(simulate(params, taps));
  });

  it("shows the row in play live", () => {
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Row 1");
    advance(900);
    pressSpace();
    advance(20);
    // Row 1 rests on the floor, so the first tap always counts.
    expect(screen.getByRole("status").textContent).toBe("Row 2");
  });

  it("shows today's target on /play, and draws its line", () => {
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} passTarget={10} />);
    expect(screen.getByText("Row 10 to pass")).toBeTruthy();
    advance(20);
    expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ passTarget: 10 });
  });

  it("rounds a fractional target up, for the HUD and the line", () => {
    // 10.2 rounds to 10 but up to 11: reaching row 10 would not be enough.
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} passTarget={10.2} />);
    expect(screen.getByText("Row 11 to pass")).toBeTruthy();
    advance(20);
    expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ passTarget: 11 });
  });

  it("gives each part of the board its Fresh Sport colour token", () => {
    const tokens: Record<string, string> = {
      "--fs-color-surface-strong": "surface-strong",
      "--fs-color-mint": "mint",
      "--fs-color-tangerine": "tangerine",
      "--fs-color-mint-dark": "mint-dark",
      "--fs-color-mint-light": "mint-light",
    };
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) => ` ${tokens[name] ?? ""} `,
    } as CSSStyleDeclaration);
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    advance(20);
    expect(drawStacking.mock.calls.at(-1)![1].colors).toEqual({
      empty: "surface-strong",
      tower: "mint",
      moving: "tangerine",
      falling: "mint-dark",
      target: "mint-light",
    });
  });

  it("shows the best row of this visit in practice, once there is one", () => {
    const { rerender } = render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} best={0} />);
    expect(screen.queryByText(/Best/)).toBeNull();
    rerender(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} best={7} />);
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
      render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
      advance(20);
      expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ reducedMotion: reduced });
      cleanup();
    }
  });

  it("finishes as soon as a row misses", () => {
    // Row 1 at 2-4; row 2 one step after appearing at the right wall keeps 3-4; row 3 tapped
    // as it appears at the left wall (0-1) misses (see stackingLoop.test.ts).
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    advance(1);
    pressSpace();
    advance(169);
    pressSpace();
    advance(1);
    pressSpace();
    advance(20);
    // The missed row falls away first (FALL_MS), then the run is reported.
    expect(onFinish).not.toHaveBeenCalled();
    advance(FALL_MS);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].result).toMatchObject({ score: 2, endReason: "miss" });
    // With no row in play, the HUD settles on the rows stacked.
    expect(screen.getByRole("status").textContent).toBe("Row 2");
  });

  it("keeps drawing the ended run for the whole fall, then reports it once", () => {
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    advance(1);
    pressSpace();
    advance(169);
    pressSpace();
    advance(1);
    pressSpace(); // the miss, at 171 ms
    advance(20);
    // The frame that saw the end: drawing carries on from there with the fixed result.
    const endFrame = drawStacking.mock.calls.findIndex(([, frame]) => frame.result.endReason === "miss");
    const endMs = drawStacking.mock.calls[endFrame][1].elapsedMs;

    advance(FALL_MS - 40);
    expect(onFinish).not.toHaveBeenCalled();
    advance(40);
    expect(onFinish).toHaveBeenCalledTimes(1);

    const reported = onFinish.mock.calls[0][0].result;
    const fallFrames = drawStacking.mock.calls.slice(endFrame).map(([, frame]) => frame);
    for (const frame of fallFrames) expect(frame.result).toEqual(reported);
    expect(fallFrames.at(-1)!.elapsedMs - endMs).toBeGreaterThanOrEqual(FALL_MS);
    // ...and stops once it has reported.
    const drawn = drawStacking.mock.calls.length;
    advance(200);
    expect(drawStacking.mock.calls.length).toBe(drawn);
  });

  it("ignores taps while the last row falls, and reports the run as it ended", () => {
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    advance(1);
    pressSpace();
    advance(169);
    pressSpace();
    advance(1);
    pressSpace(); // the miss
    advance(50);
    pressSpace(); // too late: the run is over
    advance(FALL_MS);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].taps).toHaveLength(3);
  });

  it("reports the end at once under reduced motion, as there is no fall to watch", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    advance(1);
    pressSpace();
    advance(169);
    pressSpace();
    advance(1);
    pressSpace();
    advance(20);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("draws every frame with the engine state for that moment", () => {
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    advance(100);
    const frame = drawStacking.mock.calls.at(-1)![1];
    expect(frame.params).toBe(params);
    expect(frame.elapsedMs).toBeGreaterThan(80);
    expect(frame.result).toEqual(simulate(params, [], frame.elapsedMs));
  });

  it("ignores a held Space key and other keys", () => {
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    advance(400);
    pressSpace();
    advance(100);
    pressSpace({ repeat: true });
    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    expect(onFinish.mock.calls[0]).toBeUndefined();
    const expected = missAndFinish([400]);
    expect(onFinish.mock.calls[0][0].taps).toEqual(expected);
  });

  it("drops a tap at 0 ms, as the engine does, so it cannot use up a later row's tap", () => {
    // A press in the same tick the run starts (or on a browser with a coarse clock) stamps 0 ms,
    // which the engine ignores (row 1 appears at 0). Counting it would leave row 15 without a tap
    // once MAX_TAPS is reached, and with no time limit the run would never end.
    const perfect = simulatedTaps(params, 0, 1);
    expect(simulate(params, perfect).endReason).toBe("top");
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    pressSpace(); // at 0 ms
    for (const tap of perfect) {
      advance(tap - elapsed);
      pressSpace();
    }
    advance(FALL_MS + 50);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].taps).toEqual(perfect);
    expect(onFinish.mock.calls[0][0].result).toMatchObject({ endReason: "top", score: MAX_TAPS });
  });

  it("records one tap when two inputs land at the same moment", () => {
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    advance(930);
    pressSpace();
    fireEvent.pointerDown(screen.getByRole("img", { name: /tower/i }), { isPrimary: true });
    const expected = missAndFinish([930]);
    expect(onFinish.mock.calls[0][0].taps).toEqual(expected);
  });

  it("ignores a second finger on the canvas", () => {
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    const canvas = screen.getByRole("img", { name: /tower/i });
    advance(930);
    fireEvent.pointerDown(canvas, { isPrimary: true });
    advance(5);
    fireEvent.pointerDown(canvas, { isPrimary: false });
    const expected = missAndFinish([930]);
    expect(onFinish.mock.calls[0][0].taps).toEqual(expected);
  });

  it(`never records more than ${MAX_TAPS} taps, even in a burst between two frames`, () => {
    // 20 taps half a millisecond apart all land before the first animation frame, so the run
    // has not noticed its end yet; the cap keeps the submission valid.
    const onFinish = vi.fn();
    render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    for (let i = 0; i < MAX_TAPS + 5; i++) {
      advance(0.5);
      pressSpace();
    }
    // Fifteen counted taps lock fifteen rows (or end the run sooner), so the run is over.
    advance(FALL_MS + 50);
    expect(onFinish.mock.calls[0][0].taps).toHaveLength(MAX_TAPS);
  });

  it("sizes the canvas backing store for the device pixel ratio", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 140, height: 300 } as DOMRect);
    vi.stubGlobal("devicePixelRatio", 2);
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    advance(20);
    const canvas = screen.getByRole("img", { name: /tower/i }) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([280, 600]);
    expect(drawStacking.mock.calls.at(-1)![1]).toMatchObject({ width: 140, height: 300, devicePixelRatio: 2 });
  });

  it("stops Space from scrolling the page", () => {
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    // fireEvent returns false when the handler called preventDefault.
    expect(pressSpace()).toBe(false);
  });

  it("keeps the run going when the parent passes a new onFinish", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<StackingGame countdownMs={0} params={params} onFinish={first} />);
    advance(930);
    pressSpace();
    rerender(<StackingGame countdownMs={0} params={params} onFinish={second} />);
    const expected = missAndFinish([930]);
    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls[0][0].taps).toEqual(expected);
  });

  it("marks itself as a running game, so the page can hide its back button", () => {
    const { container } = render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(container.querySelector("[data-game-running]")).not.toBeNull();
  });

  it("takes keyboard focus when it starts, so focus is not lost when the Start button goes", () => {
    render(<StackingGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("img", { name: /tower/i }));
  });

  it("stops listening and drawing once unmounted", () => {
    const onFinish = vi.fn();
    const { unmount } = render(<StackingGame countdownMs={0} params={params} onFinish={onFinish} />);
    advance(100);
    unmount();
    const draws = drawStacking.mock.calls.length;
    pressSpace();
    advance(60_000);
    expect(drawStacking.mock.calls.length).toBe(draws);
    expect(onFinish).not.toHaveBeenCalled();
  });
});
