// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ROUND_COUNTDOWN_MS, SHOW_MS, type BankShotInputs, type BankShotParams, type BankShotRound, type BankShotTap } from "@/challenges/bank-shot/engine";

// Every run: five copies of the hand-worked shot crossing at x = 75, against a 14-unit bank.
const shot: BankShotRound = { start: { x: 50, y: 150 }, velocity: { x: 0.05, y: -0.1 }, bounces: 1, glimpseMs: 1000 };
const params: BankShotParams = { bank: 14, rounds: Array.from({ length: 5 }, () => shot) };
vi.mock("@/challenges/bank-shot/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/bank-shot/engine")>();
  return { ...real, paramsFromSeed: () => params };
});
// The game has its own tests; here a stand-in finishes with whatever run the test asks.
const game = vi.hoisted(() => ({ inputs: { taps: [], endMs: 0 } as BankShotInputs }));
vi.mock("@/components/bank-shot/BankShotGame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/bank-shot/BankShotGame")>()),
  BankShotGame: ({ onFinish }: { onFinish: (inputs: BankShotInputs) => void }) => (
    <button type="button" onClick={() => onFinish(game.inputs)}>
      Fake run
    </button>
  ),
}));

import { BankShotPractice } from "./BankShotPractice";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Taps `misses[k]` right of the crossing, 500 ms after each glimpse ends. */
function run(misses: number[]): BankShotInputs {
  const taps: BankShotTap[] = [];
  let launch = ROUND_COUNTDOWN_MS;
  for (const [round, miss] of misses.entries()) {
    const atMs = launch + shot.glimpseMs + 500;
    taps.push({ round, atMs, x: 75 + miss });
    launch = atMs + SHOW_MS + ROUND_COUNTDOWN_MS;
  }
  return { taps, endMs: taps.at(-1)!.atMs + SHOW_MS };
}

async function playWith(inputs: BankShotInputs) {
  game.inputs = inputs;
  const user = userEvent.setup();
  render(<BankShotPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake run" }));
  return user;
}

describe("BankShotPractice (T245)", () => {
  it("explains the glimpse, the marker, Lock in and the bank before the start", () => {
    render(<BankShotPractice />);
    expect(screen.getByText(/^Press Start for 5 shots.*bounces off the walls.*Lock in or Enter.*one 14-unit bank.*Survive all five\. Practice never counts\.$/)).toBeTruthy();
  });

  it("passes a run that survives every shot, and plays again", async () => {
    const user = await playWith(run([0, 1, 2, 3.5, 0]));
    const heading = screen.getByRole("heading", { name: "Every shot survived" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("7.5 units of your 14-unit bank left.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });

  it("fails a run that busts the bank, with no score and no call to the server", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await playWith(run([4, 11]));
    expect(screen.getByRole("heading", { name: "1 shot survived" })).toBeTruthy();
    expect(screen.getByText("0 units of your 14-unit bank left.")).toBeTruthy();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
