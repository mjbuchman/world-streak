// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALLOWANCE_MS, LIMIT_MS, ROUND_COUNTDOWN_MS, WORD_GAP_MS, WORDS_PER_ROUND, type InkAnswer, type InkInputs, type InkParams, type InkWord } from "@/challenges/ink/engine";

// Every run: five rounds of the same eight words against a 2 000 ms bank.
const WORDS: InkWord[] = (["red", "blue", "yellow", "black", "red", "blue", "yellow", "black"] as const).map((ink, i) => ({ word: i % 2 ? "red" : ink, ink }));
const params: InkParams = { bank: 2000, rounds: ALLOWANCE_MS.map((allowanceMs, k) => ({ allowanceMs, limitMs: LIMIT_MS[k], words: WORDS })) };
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

/** Answers `n` words with their ink, `slow[w]` ms past each one's allowance (0 if not given). */
function run(n: number, slow: Record<number, number> = {}): InkInputs {
  const answers: InkAnswer[] = [];
  let appears = ROUND_COUNTDOWN_MS;
  for (let w = 0; w < n; w++) {
    const atMs = appears + ALLOWANCE_MS[Math.floor(w / WORDS_PER_ROUND)] + (slow[w] ?? 0);
    answers.push({ word: w, atMs, colour: WORDS[w % WORDS_PER_ROUND].ink });
    appears = atMs + WORD_GAP_MS + ((w + 1) % WORDS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
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

describe("InkPractice (T252)", () => {
  it("explains the ink rule, the keys and the bank before the start", () => {
    render(<InkPractice />);
    expect(
      screen.getByText(/^Tap the colour of the ink, not the word\. Keys 1 to 4 also work\. Press Start for 5 rounds of 8 colour words\..*4\.0 s time bank.*Survive all five\. Practice never counts\.$/),
    ).toBeTruthy();
  });

  it("passes a run that survives every round, and plays again", async () => {
    const user = await playWith(run(40, { 3: 500, 20: 300 }));
    const heading = screen.getByRole("heading", { name: "Every round survived" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("1.2 s of your 2.0 s bank left.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });

  it("fails a run that busts the bank in round 2, with no score and no call to the server", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await playWith(run(11, { 8: 800, 9: 800, 10: 800 }));
    expect(screen.getByRole("heading", { name: "1 round survived" })).toBeTruthy();
    expect(screen.getByText("0.0 s of your 2.0 s bank left.")).toBeTruthy();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
