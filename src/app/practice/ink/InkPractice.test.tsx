// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALLOWANCE_MS, LIMIT_MS, RUN_COUNTDOWN_MS, WORDS, WORD_GAP_MS, type InkAnswer, type InkInputs, type InkParams, type InkWord } from "@/challenges/ink/engine";

// Every run: the same eight words five times over against a 2 000 ms bank.
const EIGHT: InkWord[] = (["red", "blue", "yellow", "black", "red", "blue", "yellow", "black"] as const).map((ink, i) => ({ word: i % 2 ? "red" : ink, ink }));
const params: InkParams = { bank: 2000, words: Array.from({ length: WORDS }, (_, w) => EIGHT[w % 8]) };
vi.mock("@/challenges/ink/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/ink/engine")>();
  return { ...real, paramsFromSeed: () => params };
});
// The game has its own tests; here a stand-in finishes with whatever run the test asks.
const game = vi.hoisted(() => ({ inputs: { answers: [], endMs: 0 } as InkInputs }));
vi.mock("@/components/ink/InkGame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ink/InkGame")>()),
  InkGame: ({ onFinish }: { onFinish: (inputs: InkInputs) => void }) => (
    <button type="button" onClick={() => onFinish(game.inputs)}>
      Fake run
    </button>
  ),
}));

import { InkPractice } from "./InkPractice";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Answers `n` words with their ink, `slow[w]` ms past the allowance (0 if not given). */
function run(n: number, slow: Record<number, number> = {}): InkInputs {
  const answers: InkAnswer[] = [];
  let appears = RUN_COUNTDOWN_MS;
  for (let w = 0; w < n; w++) {
    const atMs = appears + ALLOWANCE_MS + (slow[w] ?? 0);
    answers.push({ word: w, atMs, colour: params.words[w].ink });
    appears = atMs + WORD_GAP_MS;
  }
  return { answers, endMs: answers.at(-1)!.atMs };
}

async function playWith(inputs: InkInputs) {
  game.inputs = inputs;
  const user = userEvent.setup();
  render(<InkPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake run" }));
  return user;
}

describe("InkPractice (T252, T256, T258)", () => {
  it("explains the ink rule, the keys and the one bank before the start", () => {
    render(<InkPractice />);
    expect(
      screen.getByText(/^Tap the colour of the ink, not the word\. Keys 1 to 4 also work\. Press Start for 30 colour words in a row\..*3\.2 s time bank.*Survive all 30 words\. Practice never counts\.$/),
    ).toBeTruthy();
    expect(screen.queryByText(/round/i)).toBeNull();
  });

  it("passes a run that survives all 30 words, and plays again", async () => {
    const user = await playWith(run(30, { 3: 500, 20: 300 }));
    const heading = screen.getByRole("heading", { name: "All 30 words survived" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("1.2 s of your 2.0 s bank left.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });

  it("fails a run that busts the bank part way, with words survived, no score and no call to the server", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await playWith(run(15, { 12: 800, 13: 800, 14: 800 }));
    expect(screen.getByRole("heading", { name: "14 of 30 words survived" })).toBeTruthy();
    expect(screen.getByText("0.0 s of your 2.0 s bank left.")).toBeTruthy();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("counts a missed word against the bank", async () => {
    // Two misses (1 500 each) bust the 2 000 bank on the second.
    await playWith({ answers: [], endMs: RUN_COUNTDOWN_MS + 2 * LIMIT_MS + WORD_GAP_MS + 1 });
    expect(screen.getByRole("heading", { name: "1 of 30 words survived" })).toBeTruthy();
  });
});
