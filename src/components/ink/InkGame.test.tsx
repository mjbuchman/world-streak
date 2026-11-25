// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_MS,
  LIMIT_MS,
  RUN_COUNTDOWN_MS,
  WORDS,
  WORD_GAP_MS,
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

import { HINT, InkGame, seconds } from "./InkGame";

// Word 0 matches (RED in red); word 1 is BLUE in yellow, word 3 YELLOW in black. The eight repeat to 40.
const EIGHT: InkWord[] = [
  { word: "red", ink: "red" },
  { word: "blue", ink: "yellow" },
  { word: "black", ink: "blue" },
  { word: "yellow", ink: "black" },
  { word: "red", ink: "blue" },
  { word: "yellow", ink: "yellow" },
  { word: "black", ink: "black" },
  { word: "blue", ink: "red" },
];
const paramsWith = (bank: number): InkParams => ({ bank, words: Array.from({ length: WORDS }, (_, w) => EIGHT[w % 8]) });
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

describe("InkGame (T251, T256)", () => {
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

  it("counts one 3-2-1 with no round caption and ignores answers until the first word appears", () => {
    startGame();
    expect(phase()).toBe("countdown");
    expect(screen.queryByText(/Round/)).toBeNull();
    expect(screen.getByText("3")).toBeTruthy();
    expect(canvas().getAttribute("aria-label")).toBe("Get ready.");
    expect(screen.getByText("Word 1 of 40")).toBeTruthy();
    at(500);
    give("red", "key");
    give("red", "button");
    expect(phase()).toBe("countdown");
    expect(hint()).toBe(HINT);
    frameAt(RUN_COUNTDOWN_MS);
    expect(phase()).toBe("word");
    expect(drawn.frames.at(-1)!.word).toEqual(EIGHT[0]);
    // The label never gives the answer away.
    expect(canvas().getAttribute("aria-label")).toBe("Word 1 of 40");
    expect(drawn.frames.at(-1)!.limitMs).toBe(LIMIT_MS);
    // The early presses were never recorded: the first real answer is still word 0's.
    answerNext("red");
    frameAt(log[0].atMs + FEEDBACK_MS);
    expect(onFinish).not.toHaveBeenCalled();
    expect(hint()).toBe(HINT);
  });

  it("goes from word to word with no countdown between, counting the words", () => {
    startGame();
    for (let w = 0; w < 12; w++) {
      answerNext(EIGHT[w % 8].ink);
      frameAt(log[w].atMs + FEEDBACK_MS);
      expect(phase()).toBe("gap");
      expect(screen.queryByText(/^[123]$/)).toBeNull();
    }
    frameAt(nextAppears());
    expect(screen.getByText("Word 13 of 40")).toBeTruthy();
    expect(canvas().getAttribute("aria-label")).toBe("Word 13 of 40");
    expect(drawn.frames.at(-1)!.word).toEqual(EIGHT[12 % 8]);
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
    frameAt(RUN_COUNTDOWN_MS);
    frameAt(RUN_COUNTDOWN_MS + LIMIT_MS + 1);
    expect(phase()).toBe("feedback");
    expect(drawn.frames.at(-1)!.feedback).toEqual({ result: "timeout", answer: "red" });
    expect(hint()).toBe("Too slow. It was RED.");
    expect(screen.getByText(/4\.5 s left of 6\.0 s/)).toBeTruthy();
  });

  it("drains one bank with no round divisions as the costs add up", () => {
    startGame(4000);
    answerNext("blue"); // Wrong: 1 000.
    answerNext("blue"); // Wrong again: 1 000 more.
    const costs = document.querySelectorAll("[data-bank-cost]");
    expect(costs).toHaveLength(1);
    expect((costs[0] as HTMLElement).style.width).toBe("50%");
    expect(screen.getByText("2.0 s left of 4.0 s")).toBeTruthy();
    expect(screen.queryByText(/Round/)).toBeNull();
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
    expect(ink.score(current, onFinish.mock.calls[0][0])).toBe(1);
    expect(frames).toHaveLength(0);
    // A late press does nothing more.
    give("red", "key");
    give("red", "button");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("ends the run after the 40th word, with the inputs timed from the game's start", () => {
    startGame();
    for (let w = 0; w < WORDS; w++) {
      answerNext(EIGHT[w % 8].ink, w % 2 ? "key" : "button");
      frameAt(log[w].atMs + FEEDBACK_MS);
    }
    expect(phase()).toBe("done");
    const inputs = onFinish.mock.calls[0][0];
    expect(inputs).toEqual({ answers: log, endMs: log[WORDS - 1].atMs + FEEDBACK_MS });
    expect(inputs.answers[0].atMs).toBe(RUN_COUNTDOWN_MS + 400);
    expect(ink.score(current, inputs)).toBe(41);
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
  it("shows seconds to one decimal", () => {
    expect([seconds(4200), seconds(4249), seconds(0)]).toEqual(["4.2 s", "4.2 s", "0.0 s"]);
  });
});
