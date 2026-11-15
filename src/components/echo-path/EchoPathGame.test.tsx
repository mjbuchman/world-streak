// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sequenceFor, type EchoPathParams } from "@/challenges/echo-path/engine";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { BETWEEN_MS, EchoPathGame } from "./EchoPathGame";

const params: EchoPathParams = { cols: 3, rows: 3, startLength: 3, maxLength: 4, stepMs: 400, sequenceSeed: 21 };

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const ctx = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: "", globalAlpha: 1 };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  // A 300 px board at the page's top left: tiles of 84 px, 12 px apart.
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

/** Taps a tile's centre at the current clock. */
function tapTile(tile: number) {
  vi.spyOn(performance, "now").mockReturnValue(clock);
  fireEvent.pointerDown(canvas(), { button: 0, clientX: 54 + (tile % 3) * 96, clientY: 54 + Math.floor(tile / 3) * 96 });
}

const canvas = () => document.querySelector("canvas")!;
const phase = () => canvas().dataset.phase;
const lives = () => screen.getByRole("img", { name: /lives left$/ }).getAttribute("aria-label");

describe("EchoPathGame", () => {
  it("counts 3-2-1, plays the sequence back by elapsed time, and ignores taps until it has played", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame params={params} onFinish={onFinish} />);
    frameAt(1000);
    expect(phase()).toBe("countdown");
    frameAt(1000 + RUN_COUNTDOWN_MS);
    expect(phase()).toBe("watch");
    expect(canvas().getAttribute("aria-label")).toBe("Watch the tiles light up.");
    // A wrong tile during the playback costs nothing: it is ignored.
    tapTile((sequenceFor(params, 3, 0)[0] + 1) % 9);
    expect(lives()).toBe("3 of 3 lives left");
    frameAt(1000 + RUN_COUNTDOWN_MS + 1199);
    expect(phase()).toBe("watch");
    frameAt(1000 + RUN_COUNTDOWN_MS + 1200);
    expect(phase()).toBe("repeat");
    expect(lives()).toBe("3 of 3 lives left");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("clears a round, then after a pause plays the next, longer one; a mistake costs a life and replays a new one", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(0);
    frameAt(1200);
    for (const tile of sequenceFor(params, 3, 0)) tapTile(tile);
    expect(screen.getByText("Length 4 · best 3")).toBeTruthy();
    // The pause, then the 4-tile playback: a wrong tile in either costs nothing.
    const wrong = (sequenceFor(params, 4, 0)[0] + 1) % 9;
    frameAt(1200 + BETWEEN_MS - 1);
    expect(phase()).toBe("watch");
    tapTile(wrong);
    frameAt(1200 + BETWEEN_MS + 1599);
    tapTile(wrong);
    expect(lives()).toBe("3 of 3 lives left");
    frameAt(1200 + BETWEEN_MS + 1600);
    expect(phase()).toBe("repeat");
    // Now a wrong first tile: a life goes and length 4 replays with a new sequence.
    tapTile(wrong);
    expect(lives()).toBe("2 of 3 lives left");
    expect(phase()).toBe("watch");
    // Taps during the pause after the miss do not count either.
    const retry = sequenceFor(params, 4, 1);
    tapTile((retry[0] + 1) % 9);
    expect(lives()).toBe("2 of 3 lives left");
    // After the pause and playback, the new sequence (not the first one) clears length 4, the last.
    frameAt(clock + BETWEEN_MS + 1600);
    for (const tile of retry) tapTile(tile);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish.mock.calls[0][0].taps.map((tap: { tile: number }) => tap.tile)).toEqual([...sequenceFor(params, 3, 0), wrong, ...retry]);
    expect(screen.getByText("Length 4 · best 4")).toBeTruthy();
  });

  it("takes keys 1 to 9 as taps on the tiles, row by row", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(0);
    frameAt(1200);
    for (const tile of sequenceFor(params, 3, 0)) fireEvent.keyDown(canvas(), { key: String(tile + 1) });
    expect(screen.getByText("Length 4 · best 3")).toBeTruthy();
    // Other keys, 0 and held repeats do nothing.
    frameAt(1200 + BETWEEN_MS + 1600);
    fireEvent.keyDown(canvas(), { key: "0" });
    fireEvent.keyDown(canvas(), { key: "a" });
    fireEvent.keyDown(canvas(), { key: String(((sequenceFor(params, 4, 0)[0] + 1) % 9) + 1), repeat: true });
    expect(lives()).toBe("3 of 3 lives left");
    expect(canvas().tabIndex).toBe(0);
  });

  it("reports every tap, timed from the first frame, when the run ends", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(500);
    frameAt(1700);
    const first = sequenceFor(params, 3, 0)[0];
    const wrong = (first + 1) % 9;
    tapTile(wrong);
    // Each miss pauses and replays: wait out the pause and the 3-tile playback each time.
    frameAt(1700 + BETWEEN_MS + 1200);
    const second = (sequenceFor(params, 3, 1)[0] + 1) % 9;
    tapTile(second);
    frameAt(clock + BETWEEN_MS + 1200);
    const third = (sequenceFor(params, 3, 2)[0] + 1) % 9;
    tapTile(third);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      taps: [
        { tile: wrong, atMs: 1200 },
        { tile: second, atMs: 1200 + BETWEEN_MS + 1200 },
        { tile: third, atMs: 1200 + 2 * (BETWEEN_MS + 1200) },
      ],
    });
    expect(phase()).toBe("done");
    expect(lives()).toBe("0 of 3 lives left");
    // No tap counts after the end.
    tapTile(first);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("ignores taps in the gaps between tiles and with other buttons", () => {
    render(<EchoPathGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    frameAt(0);
    frameAt(1200);
    const [first, ...rest] = sequenceFor(params, 3, 0);
    const centre = (tile: number) => ({ clientX: 54 + (tile % 3) * 96, clientY: 54 + Math.floor(tile / 3) * 96 });
    // A right-click on a wrong tile costs nothing; one on the right tile does not count as a step.
    fireEvent.pointerDown(canvas(), { button: 2, ...centre((first + 1) % 9) });
    fireEvent.pointerDown(canvas(), { button: 2, ...centre(first) });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 100, clientY: 54 });
    expect(lives()).toBe("3 of 3 lives left");
    // So the sequence still needs all three taps: two would not clear it.
    for (const tile of rest) tapTile(tile);
    expect(lives()).toBe("2 of 3 lives left");
  });

  it("stops its frame loop when it leaves the screen", () => {
    const { unmount } = render(<EchoPathGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
