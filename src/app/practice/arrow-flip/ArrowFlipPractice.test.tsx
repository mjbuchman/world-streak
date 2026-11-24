// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWANCE_MS,
  LIMIT_MS,
  PROMPT_GAP_MS,
  PROMPTS_PER_ROUND,
  ROUND_COUNTDOWN_MS,
  answerOf,
  type ArrowFlipAnswer,
  type ArrowFlipInputs,
  type ArrowFlipParams,
  type ArrowFlipPrompt,
  type Direction,
} from "@/challenges/arrow-flip/engine";

// Every run: five rounds of the same six prompts against a 2 000 ms bank.
const PROMPTS: ArrowFlipPrompt[] = (["left", "up", "right", "down", "left", "up"] as Direction[]).map((dir) => ({ arrow: dir, word: dir, cue: "word" }));
const params: ArrowFlipParams = { bank: 2000, rounds: ALLOWANCE_MS.map((allowanceMs, k) => ({ allowanceMs, limitMs: LIMIT_MS[k], prompts: PROMPTS })) };
vi.mock("@/challenges/arrow-flip/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/arrow-flip/engine")>();
  return { ...real, paramsFromSeed: () => params };
});
// The game has its own tests; here a stand-in finishes with whatever run the test asks.
const game = vi.hoisted(() => ({ inputs: { answers: [], endMs: 0 } as ArrowFlipInputs }));
vi.mock("@/components/arrow-flip/ArrowFlipGame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/arrow-flip/ArrowFlipGame")>()),
  ArrowFlipGame: ({ onFinish }: { onFinish: (inputs: ArrowFlipInputs) => void }) => (
    <button type="button" onClick={() => onFinish(game.inputs)}>
      Fake run
    </button>
  ),
}));

import { ArrowFlipPractice } from "./ArrowFlipPractice";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Answers `n` prompts right, `slow[p]` ms past each one's allowance (0 if not given). */
function run(n: number, slow: Record<number, number> = {}): ArrowFlipInputs {
  const answers: ArrowFlipAnswer[] = [];
  let appears = ROUND_COUNTDOWN_MS;
  for (let p = 0; p < n; p++) {
    const atMs = appears + ALLOWANCE_MS[Math.floor(p / PROMPTS_PER_ROUND)] + (slow[p] ?? 0);
    answers.push({ prompt: p, atMs, dir: answerOf(PROMPTS[p % PROMPTS_PER_ROUND]) });
    appears = atMs + PROMPT_GAP_MS + ((p + 1) % PROMPTS_PER_ROUND === 0 ? ROUND_COUNTDOWN_MS : 0);
  }
  return { answers, endMs: answers.at(-1)!.atMs };
}

async function playWith(inputs: ArrowFlipInputs) {
  game.inputs = inputs;
  const user = userEvent.setup();
  render(<ArrowFlipPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake run" }));
  return user;
}

describe("ArrowFlipPractice (T246)", () => {
  it("explains the cue, the three ways to answer and the bank before the start", () => {
    render(<ArrowFlipPractice />);
    expect(screen.getByText(/^Press Start for 5 rounds of 6 prompts.*WORD means.*ARROW.*Swipe.*arrow key.*time bank.*Survive all five\. Practice never counts\.$/)).toBeTruthy();
  });

  it("passes a run that survives every round, and plays again", async () => {
    const user = await playWith(run(30, { 3: 500, 20: 300 }));
    const heading = screen.getByRole("heading", { name: "Every round survived" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("1.2 s of your 2.0 s bank left.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });

  it("fails a run that busts the bank in round 2, with no score and no call to the server", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await playWith(run(9, { 6: 800, 7: 800, 8: 800 }));
    expect(screen.getByRole("heading", { name: "1 round survived" })).toBeTruthy();
    expect(screen.getByText("0.0 s of your 2.0 s bank left.")).toBeTruthy();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
