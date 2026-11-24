// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWANCE_MS,
  FEEDBACK_MS,
  LIMIT_MS,
  ROUND_COUNTDOWN_MS,
  TOTAL_PROMPTS,
  answerOf,
  arrowFlip,
  play,
  type ArrowFlipInputs,
  type ArrowFlipParams,
  type ArrowFlipPrompt,
  type Direction,
} from "@/challenges/arrow-flip/engine";
import type { ArrowFlipFrame } from "@/challenges/arrow-flip/render";

// The drawing has its own tests; here each frame handed to it is kept, to see what the screen shows.
const drawn = vi.hoisted(() => ({ frames: [] as ArrowFlipFrame[] }));
vi.mock("@/challenges/arrow-flip/render", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/arrow-flip/render")>();
  return { ...real, drawArrowFlip: (_ctx: unknown, frame: ArrowFlipFrame) => drawn.frames.push(frame) };
});

import { ArrowFlipGame, roundCosts, seconds } from "./ArrowFlipGame";

// Prompt 0 matches (LEFT / LEFT, cue WORD); prompt 1 is a mismatch on WORD (UP arrow, RIGHT);
// prompt 2 a mismatch on ARROW (LEFT arrow, DOWN). Every round repeats them.
const PROMPTS: ArrowFlipPrompt[] = [
  { arrow: "left", word: "left", cue: "word" },
  { arrow: "up", word: "right", cue: "word" },
  { arrow: "left", word: "down", cue: "arrow" },
  { arrow: "up", word: "up", cue: "arrow" },
  { arrow: "down", word: "down", cue: "word" },
  { arrow: "right", word: "left", cue: "arrow" },
];
const paramsWith = (bank: number): ArrowFlipParams => ({ bank, rounds: ALLOWANCE_MS.map((allowanceMs, k) => ({ allowanceMs, limitMs: LIMIT_MS[k], prompts: PROMPTS })) });
const params = paramsWith(6000);
const START = 1000;

let frames: FrameRequestCallback[];
let current: ArrowFlipParams;
let onFinish: ReturnType<typeof vi.fn<(inputs: ArrowFlipInputs) => void>>;
let clock: number;

beforeEach(() => {
  frames = [];
  drawn.frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const ctx = new Proxy({} as Record<string, unknown>, { get: (target, name: string) => (name in target ? target[name] : () => undefined) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs the next animation frame at game time `t` (input handlers read the same clock). */
function frameAt(t: number) {
  clock = START + t;
  vi.spyOn(performance, "now").mockReturnValue(clock);
  const next = frames.shift();
  if (!next) throw new Error("No frame was requested");
  act(() => next(clock));
}
/** Moves the input clock alone to game time `t`. */
const at = (t: number) => vi.spyOn(performance, "now").mockReturnValue(START + t);

const canvas = () => document.querySelector("canvas")!;
const phase = () => canvas().dataset.phase;
/** The game's own live status (the bank gauge has one too, before it). */
const hint = () => [...document.querySelectorAll("[aria-live]")].at(-1)!.textContent;
const swipe = (dx: number, dy: number) => {
  fireEvent.pointerDown(canvas(), { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(canvas(), { button: 0, clientX: 100 + dx, clientY: 100 + dy });
};
const SWIPES: Record<Direction, [number, number]> = { left: [-60, 0], right: [60, 0], up: [0, -60], down: [0, 60] };
const KEYS: Record<Direction, string> = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };
const NAMES: Record<Direction, string> = { left: "Left", right: "Right", up: "Up", down: "Down" };
type Via = "swipe" | "key" | "button";
function give(dir: Direction, via: Via = "swipe") {
  if (via === "swipe") swipe(...SWIPES[dir]);
  else if (via === "key") fireEvent.keyDown(canvas(), { key: KEYS[dir] });
  else fireEvent.click(screen.getByRole("button", { name: NAMES[dir] }));
}
/** When the next prompt appears, per the engine, given the answers so far. */
const nextAppears = () => play(current, { answers: log, endMs: clock - START }).appearsAt!;
let log: ArrowFlipInputs["answers"];

function startGame(bank = 6000) {
  current = paramsWith(bank);
  onFinish = vi.fn<(inputs: ArrowFlipInputs) => void>();
  log = [];
  render(<ArrowFlipGame params={current} onFinish={onFinish} />);
  frameAt(0);
  return log;
}

/** Shows the next prompt, then answers it `reaction` ms later with `dir` by `via`, logging the answer the game should record. */
function answerNext(log: ArrowFlipInputs["answers"], dir: Direction, via: Via = "swipe", reaction = 400) {
  const appears = nextAppears();
  frameAt(appears);
  expect(phase()).toBe("prompt");
  at(appears + reaction);
  give(dir, via);
  log.push({ prompt: log.length, atMs: appears + reaction, dir });
  clock = START + appears + reaction;
}

describe("ArrowFlipGame (T238)", () => {
  it("counts 3-2-1 with a Round 1 caption and ignores answers until the prompt appears", () => {
    startGame();
    expect(phase()).toBe("countdown");
    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(canvas().getAttribute("aria-label")).toBe("Round 1. Get ready.");
    at(500);
    give("left", "key");
    give("left", "button");
    swipe(-60, 0);
    frameAt(ROUND_COUNTDOWN_MS);
    expect(phase()).toBe("prompt");
    expect(drawn.frames.at(-1)!.prompt).toEqual(PROMPTS[0]);
    // The label never gives the answer away.
    expect(canvas().getAttribute("aria-label")).toBe("Prompt 1 of 6, round 1");
    expect(drawn.frames.at(-1)!.limitMs).toBe(LIMIT_MS[0]);
  });

  it("takes a right swipe on a matching prompt and on a mismatched ARROW cue, and shows a feedback beat", () => {
    const log = startGame();
    answerNext(log, "left");
    expect(phase()).toBe("feedback");
    expect(hint()).toBe("Right");
    frameAt(log[0].atMs + 10);
    expect(drawn.frames.at(-1)!.feedback).toEqual({ result: "right", answer: "left" });
    frameAt(log[0].atMs + FEEDBACK_MS);
    expect(phase()).toBe("gap");
    answerNext(log, answerOf(PROMPTS[1]));
    answerNext(log, "left"); // The ARROW cue on a LEFT arrow over the word DOWN.
    expect(hint()).toBe("Right");
    expect(screen.getByText(/6\.0 s left of 6\.0 s/)).toBeTruthy();
  });

  it("marks a wrong answer, the word's direction on an ARROW cue, and names the right one", () => {
    const log = startGame();
    answerNext(log, "left");
    answerNext(log, "right");
    answerNext(log, "down"); // The word, not the arrow.
    expect(hint()).toBe("Wrong. It was LEFT.");
    frameAt(log[2].atMs + 10);
    expect(drawn.frames.at(-1)!.feedback).toEqual({ result: "wrong", answer: "left" });
    expect(screen.getByText(/5\.0 s left of 6\.0 s/)).toBeTruthy();
  });

  it("times a prompt out and shows the right answer as text", () => {
    startGame();
    frameAt(ROUND_COUNTDOWN_MS);
    frameAt(ROUND_COUNTDOWN_MS + LIMIT_MS[0] + 1);
    expect(phase()).toBe("feedback");
    expect(drawn.frames.at(-1)!.feedback).toEqual({ result: "timeout", answer: "left" });
    expect(hint()).toBe("Too slow. It was LEFT.");
    expect(canvas().getAttribute("aria-label")).toBe("Next prompt coming.");
    expect(screen.getByText(/4\.5 s left of 6\.0 s/)).toBeTruthy();
  });

  it("gives the same answer from a button, a key and a swipe, and ignores a too-short swipe", () => {
    const log = startGame();
    const appears = ROUND_COUNTDOWN_MS;
    frameAt(appears);
    at(appears + 100);
    swipe(-23, 0);
    expect(phase()).toBe("prompt");
    log.push({ prompt: 0, atMs: appears + 200, dir: "left" });
    at(appears + 200);
    clock = START + appears + 200;
    give("left", "button");
    expect(hint()).toBe("Right");
    answerNext(log, "right", "key");
    expect(hint()).toBe("Right");
    // A held key's repeats never answer the next prompt.
    frameAt(nextAppears());
    fireEvent.keyDown(canvas(), { key: "ArrowLeft", repeat: true });
    expect(phase()).toBe("prompt");
    answerNext(log, "left", "swipe");
    expect(hint()).toBe("Right");
  });

  it("ends the run on a bust and reports answers the engine re-scores the same", () => {
    const log = startGame(1000);
    answerNext(log, "right"); // Wrong on prompt 0: 1 000 of the 1 000 bank, still alive.
    expect(screen.getByText(/0\.0 s left of 1\.0 s/)).toBeTruthy();
    answerNext(log, "left"); // Wrong again: bust.
    frameAt(log[1].atMs + 10);
    expect(onFinish).not.toHaveBeenCalled();
    frameAt(log[1].atMs + FEEDBACK_MS);
    expect(phase()).toBe("done");
    expect(onFinish).toHaveBeenCalledWith({ answers: log, endMs: log[1].atMs + FEEDBACK_MS });
    expect(arrowFlip.score(current, onFinish.mock.calls[0][0])).toBe(0);
    expect(frames).toHaveLength(0);
    // A late press does nothing more.
    give("left", "key");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("ends the run after the last prompt", () => {
    const log = startGame();
    for (let p = 0; p < TOTAL_PROMPTS; p++) {
      answerNext(log, answerOf(PROMPTS[p % 6]), "key");
      frameAt(log[p].atMs + FEEDBACK_MS);
    }
    expect(phase()).toBe("done");
    const inputs = onFinish.mock.calls[0][0];
    expect(inputs.answers).toEqual(log);
    expect(arrowFlip.score(current, inputs)).toBe(6);
  });

  it("stops its frame loop on unmount", () => {
    const { unmount } = render(<ArrowFlipGame params={params} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});

describe("Arrow Flip readings", () => {
  it("shows seconds to one decimal and sums costs per round", () => {
    expect([seconds(4200), seconds(4249), seconds(0)]).toEqual(["4.2 s", "4.2 s", "0.0 s"]);
    expect(roundCosts([100, 0, 0, 0, 0, 200, 300])).toEqual([300, 300]);
  });
});
