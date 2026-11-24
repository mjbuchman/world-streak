// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bankShot, ROUND_COUNTDOWN_MS, SHOW_MS, TAP_LIMIT_MS, type BankShotInputs, type BankShotParams, type BankShotRound } from "@/challenges/bank-shot/engine";
import type { BankShotFrame } from "@/challenges/bank-shot/render";

// The drawing has its own tests; here each frame handed to it is kept, to see what the screen shows.
const drawn = vi.hoisted(() => ({ frames: [] as BankShotFrame[] }));
vi.mock("@/challenges/bank-shot/render", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/bank-shot/render")>();
  return { ...real, drawBankShot: (_ctx: unknown, frame: BankShotFrame) => drawn.frames.push(frame) };
});

import { BankShotGame } from "./BankShotGame";

// The hand-worked T230 shot every round: one bounce off the right wall, crossing at x = 75.
const shot: BankShotRound = { start: { x: 50, y: 150 }, velocity: { x: 0.05, y: -0.1 }, bounces: 1, glimpseMs: 1000 };
const params: BankShotParams = { bank: 14, rounds: Array.from({ length: 5 }, () => shot) };
/** The game's first frame is at START; round 1's puck launches at LAUNCH and vanishes at GONE. */
const START = 1000;
const LAUNCH = START + ROUND_COUNTDOWN_MS;
const GONE = LAUNCH + shot.glimpseMs;

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  drawn.frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const ctx = new Proxy({} as Record<string, unknown>, { get: (target, name: string) => (name in target ? target[name] : () => undefined) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  // A canvas at the layout's own 108 x 174 units: one px a unit, the board 4 px in, so board x is client x - 4.
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 108, height: 174 } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs the next animation frame at `now` ms (input handlers read the same clock). */
function frameAt(now: number) {
  vi.spyOn(performance, "now").mockReturnValue(now);
  const next = frames.shift();
  if (!next) throw new Error("No frame was requested");
  act(() => next(now));
}

const canvas = () => document.querySelector("canvas")!;
const phase = () => canvas().dataset.phase;
const lockButton = () => screen.getByRole<HTMLButtonElement>("button", { name: "Lock in" });
const lastFrame = () => drawn.frames.at(-1)!;
/** Taps the board straight below board x. */
const tapAt = (x: number) => fireEvent.pointerDown(canvas(), { button: 0, clientX: x + 4, clientY: 120 });

function startGame(onFinish = vi.fn<(inputs: BankShotInputs) => void>()) {
  render(<BankShotGame params={params} onFinish={onFinish} />);
  frameAt(START);
  frameAt(GONE);
  return onFinish;
}

describe("BankShotGame", () => {
  it("counts 3-2-1 with a Round 1 caption, then shows the puck, and ignores taps until it vanishes", () => {
    render(<BankShotGame params={params} onFinish={vi.fn()} />);
    frameAt(START);
    expect(phase()).toBe("countdown");
    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(lastFrame().round).toBeNull();
    frameAt(LAUNCH + 500);
    expect(phase()).toBe("glimpse");
    expect(lastFrame()).toMatchObject({ round: 0, msSinceLaunch: 500, marker: null });
    tapAt(40);
    fireEvent.keyDown(canvas(), { key: "ArrowRight" });
    fireEvent.keyDown(canvas(), { key: "Enter" });
    frameAt(GONE - 1);
    expect(lastFrame().marker).toBeNull();
    expect(lockButton().disabled).toBe(true);
    frameAt(GONE);
    expect(phase()).toBe("aim");
    expect(lockButton().disabled).toBe(true);
  });

  it("places and moves the marker by tap and drag, locks it in, reveals the crossing, then a 3-2-1 for round 2", () => {
    const onFinish = startGame();
    tapAt(40);
    fireEvent.pointerMove(canvas(), { clientX: 79, clientY: 120 });
    fireEvent.pointerUp(canvas(), { clientX: 79, clientY: 120 });
    fireEvent.pointerMove(canvas(), { clientX: 10, clientY: 120 });
    frameAt(GONE + 100);
    expect(lastFrame().marker).toBeCloseTo(75, 9);
    expect(lockButton().disabled).toBe(false);
    vi.spyOn(performance, "now").mockReturnValue(GONE + 500);
    fireEvent.click(lockButton());
    fireEvent.click(lockButton());
    expect(phase()).toBe("result");
    expect(screen.getByText("Right on the crossing.")).toBeTruthy();
    expect(screen.getByText("14 left of 14")).toBeTruthy();
    frameAt(GONE + 600);
    expect(lastFrame()).toMatchObject({ round: 0, marker: 75, reveal: { crossingX: 75, miss: 0 }, missTint: 0 });
    frameAt(GONE + 500 + SHOW_MS);
    expect(phase()).toBe("countdown");
    expect(screen.getByText("Round 2")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Round 2 of 5" })).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
    // A fresh round starts with no marker.
    frameAt(GONE + 500 + SHOW_MS + ROUND_COUNTDOWN_MS + shot.glimpseMs);
    expect(lastFrame().marker).toBeNull();
  });

  it("moves the marker with the arrow keys (Shift for 5), and a miss past the bank ends the run after its reveal", () => {
    const onFinish = startGame();
    fireEvent.keyDown(canvas(), { key: "ArrowRight" });
    fireEvent.keyDown(canvas(), { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(canvas(), { key: "ArrowLeft" });
    fireEvent.keyDown(canvas(), { key: "x" });
    frameAt(GONE + 100);
    expect(lastFrame().marker).toBe(55);
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(screen.getByText("20 units off. More than the bank had left.")).toBeTruthy();
    expect(screen.getByText("Bank used up")).toBeTruthy();
    frameAt(GONE + 200);
    expect(lastFrame()).toMatchObject({ reveal: { crossingX: 75, miss: 20 }, missTint: 0.35 });
    frameAt(GONE + 100 + SHOW_MS);
    const inputs = { taps: [{ round: 0, atMs: GONE + 100 - START, x: 55 }], endMs: GONE + 100 + SHOW_MS - START };
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(inputs);
    expect(bankShot.score(params, inputs)).toBe(0);
    expect(phase()).toBe("done");
    expect(frames).toHaveLength(0);
  });

  it("times a round out at the tap limit, shows the real crossing, and reports a run the engine also times out", () => {
    const onFinish = startGame();
    tapAt(70);
    const deadline = GONE + TAP_LIMIT_MS;
    frameAt(deadline);
    expect(phase()).toBe("aim");
    frameAt(deadline + 1);
    expect(phase()).toBe("result");
    expect(screen.getByText("Time's up.")).toBeTruthy();
    expect(lastFrame()).toMatchObject({ marker: null, reveal: { miss: null }, missTint: 0.35 });
    expect(lastFrame().reveal!.crossingX).toBeCloseTo(75, 9);
    expect(lockButton().disabled).toBe(true);
    frameAt(deadline + SHOW_MS);
    const [[inputs]] = onFinish.mock.calls;
    expect(inputs).toEqual({ taps: [], endMs: deadline + SHOW_MS - START });
    expect(bankShot.score(params, inputs)).toBe(0);
    expect(bankShot.finished(params, inputs)).toBe(true);
  });

  it("stops its frame loop when it leaves the screen", () => {
    const { unmount } = render(<BankShotGame params={params} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
