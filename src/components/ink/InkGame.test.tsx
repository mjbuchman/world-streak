// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWANCE_MS,
  FEEDBACK_MS,
  LIMIT_MS,
  ROUND_COUNTDOWN_MS,
  TOTAL_WORDS,
  WORD_GAP_MS,
  WORDS_PER_ROUND,
  ink,
  play,
  type Colour,
  type InkInputs,
  type InkParams,
  type InkWord,
} from "@/challenges/ink/engine";
import type { InkFrame } from "@/challenges/ink/render";

// The drawing has its own tests; here each frame handed to it is kept, to see what the screen shows.
const drawn = vi.hoisted(() => ({ frames: [] as InkFrame[] }));
vi.mock("@/challenges/ink/render", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/ink/render")>();
  return { ...real, drawInk: (_ctx: unknown, frame: InkFrame) => drawn.frames.push(frame) };
});

import { HINT, InkGame, roundCosts, seconds } from "./InkGame";

// Word 0 matches (RED in red); word 1 is BLUE in yellow, word 3 YELLOW in black. Every round repeats them.
const WORDS: InkWord[] = [
  { word: "red", ink: "red" },
  { word: "blue", ink: "yellow" },
  { word: "black", ink: "blue" },
  { word: "yellow", ink: "black" },
  { word: "red", ink: "blue" },
  { word: "yellow", ink: "yellow" },
  { word: "black", ink: "black" },
  { word: "blue", ink: "red" },
];
const paramsWith = (bank: number): InkParams => ({ bank, rounds: ALLOWANCE_MS.map((allowanceMs, k) => ({ allowanceMs, limitMs: LIMIT_MS[k], words: WORDS })) });
const START = 1000;

let frames: FrameRequestCallback[];
let current: InkParams;
let onFinish: ReturnType<typeof vi.fn<(inputs: InkInputs) => void>>;
let clock: number;
let log: InkInputs["answers"];

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
const KEYS: Record<Colour, string> = { red: "1", blue: "2", yellow: "3", black: "4" };
const NAMES: Record<Colour, string> = { red: "Red", blue: "Blue", yellow: "Yellow", black: "Black" };
type Via = "key" | "button";
function give(colour: Colour, via: Via = "button") {
  if (via === "key") fireEvent.keyDown(document.body, { key: KEYS[colour] });
  else fireEvent.click(screen.getByRole("button", { name: NAMES[colour] }));
}
/** When the next word appears, per the engine, given the answers so far. */
const nextAppears = () => play(current, { answers: log, endMs: clock - START }).appearsAt!;

function startGame(bank = 6000) {
  current = paramsWith(bank);
  onFinish = vi.fn<(inputs: InkInputs) => void>();
  log = [];
  render(<InkGame params={current} onFinish={onFinish} />);
  frameAt(0);
  return log;
}

/** Shows the next word, then answers it `reaction` ms later with `colour` by `via`, logging the answer the game should record. */
function answerNext(colour: Colour, via: Via = "button", reaction = 400) {
  const appears = nextAppears();
  frameAt(appears);
  expect(phase()).toBe("word");
  at(appears + reaction);
  give(colour, via);
  log.push({ word: log.length, atMs: appears + reaction, colour });
  clock = START + appears + reaction;
}

describe("InkGame (T251)", () => {
  it("shows four named buttons in key order, each with its label, in a beat shorter than the gap", () => {
    startGame();
    const buttons = within(document.querySelector("div")!).getAllByRole("button");
    expect(buttons.map((b) => [b.getAttribute("aria-label"), b.textContent])).toEqual([
      [null, "Red"],
      [null, "Blue"],
      [null, "Yellow"],
      [null, "Black"],
    ]);
    expect(FEEDBACK_MS).toBeLessThan(WORD_GAP_MS);
    expect(hint()).toBe(HINT);
  });

  it("counts 3-2-1 with a Round 1 caption and ignores answers until the word appears", () => {
    startGame();
    expect(phase()).toBe("countdown");
    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(canvas().getAttribute("aria-label")).toBe("Round 1. Get ready.");
    at(500);
    give("red", "key");
    give("red", "button");
    expect(phase()).toBe("countdown");
    expect(hint()).toBe(HINT);
    frameAt(ROUND_COUNTDOWN_MS);
    expect(phase()).toBe("word");
    expect(drawn.frames.at(-1)!.word).toEqual(WORDS[0]);
    // The label never gives the answer away.
    expect(canvas().getAttribute("aria-label")).toBe("Word 1 of 8, round 1");
    expect(drawn.frames.at(-1)!.limitMs).toBe(LIMIT_MS[0]);
    // The early presses were never recorded: the first real answer is still word 0's.
    answerNext("red");
    frameAt(log[0].atMs + FEEDBACK_MS);
    expect(onFinish).not.toHaveBeenCalled();
    expect(hint()).toBe(HINT);
  });

  it("takes a correct tap on a matching and on a mismatched word, and shows a feedback beat", () => {
    startGame();
    answerNext("red");
    expect(phase()).toBe("feedback");
    expect(hint()).toBe("Correct");
    frameAt(log[0].atMs + 10);
    expect(drawn.frames.at(-1)!.feedback).toEqual({ result: "right", answer: "red" });
    frameAt(log[0].atMs + FEEDBACK_MS);
    expect(phase()).toBe("gap");
    expect(canvas().getAttribute("aria-label")).toBe("Next word coming.");
    answerNext("yellow"); // BLUE in yellow ink.
    expect(hint()).toBe("Correct");
    expect(screen.getByText(/6\.0 s left of 6\.0 s/)).toBeTruthy();
  });

  it("marks a tap of the word's own name on a mismatched word wrong, and names the ink", () => {
    startGame();
    answerNext("red");
    answerNext("blue"); // The word, not the ink.
    expect(hint()).toBe("Wrong. It was YELLOW.");
    frameAt(log[1].atMs + 10);
    expect(drawn.frames.at(-1)!.feedback).toEqual({ result: "wrong", answer: "yellow" });
    expect(screen.getByText(/5\.0 s left of 6\.0 s/)).toBeTruthy();
  });

  it("times a word out and shows the right colour as text", () => {
    startGame();
    frameAt(ROUND_COUNTDOWN_MS);
    frameAt(ROUND_COUNTDOWN_MS + LIMIT_MS[0] + 1);
    expect(phase()).toBe("feedback");
    expect(drawn.frames.at(-1)!.feedback).toEqual({ result: "timeout", answer: "red" });
    expect(hint()).toBe("Too slow. It was RED.");
    expect(screen.getByText(/4\.5 s left of 6\.0 s/)).toBeTruthy();
  });

  it("gives the same answer from a key as from a button, and ignores held and modified keys", () => {
    startGame();
    answerNext("red", "key");
    expect(hint()).toBe("Correct");
    frameAt(nextAppears());
    fireEvent.keyDown(document.body, { key: "3", repeat: true });
    fireEvent.keyDown(document.body, { key: "3", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "5" });
    expect(phase()).toBe("word");
    answerNext("yellow", "key");
    expect(hint()).toBe("Correct");
    answerNext("blue", "button");
    expect(hint()).toBe("Correct");
  });

  it("ends the run on a bust and reports answers the engine re-scores the same", () => {
    startGame(1000);
    answerNext("blue"); // Wrong on word 0: 1 000 of the 1 000 bank, still alive.
    expect(screen.getByText(/0\.0 s left of 1\.0 s/)).toBeTruthy();
    answerNext("blue"); // The word's name again: bust.
    frameAt(log[1].atMs + 10);
    expect(onFinish).not.toHaveBeenCalled();
    frameAt(log[1].atMs + FEEDBACK_MS);
    expect(phase()).toBe("done");
    expect(onFinish).toHaveBeenCalledWith({ answers: log, endMs: log[1].atMs + FEEDBACK_MS });
    expect(ink.score(current, onFinish.mock.calls[0][0])).toBe(0);
    expect(frames).toHaveLength(0);
    // A late press does nothing more.
    give("red", "key");
    give("red", "button");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("ends the run after the last word", () => {
    startGame();
    for (let w = 0; w < TOTAL_WORDS; w++) {
      answerNext(WORDS[w % WORDS_PER_ROUND].ink, w % 2 ? "key" : "button");
      frameAt(log[w].atMs + FEEDBACK_MS);
    }
    expect(phase()).toBe("done");
    const inputs = onFinish.mock.calls[0][0];
    expect(inputs.answers).toEqual(log);
    expect(ink.score(current, inputs)).toBe(6);
  });

  it("stops its frame loop and its key listener on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<InkGame params={paramsWith(6000)} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});

describe("Ink readings", () => {
  it("shows seconds to one decimal and sums costs per round", () => {
    expect([seconds(4200), seconds(4249), seconds(0)]).toEqual(["4.2 s", "4.2 s", "0.0 s"]);
    expect(roundCosts([100, 0, 0, 0, 0, 0, 0, 200, 300])).toEqual([300, 300]);
  });
});
