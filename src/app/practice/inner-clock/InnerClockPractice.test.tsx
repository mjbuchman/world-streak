// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimeBankInputs } from "@/challenges/inner-clock/timeBank";

// The game itself has its own tests; here a stand-in finishes with whatever the test asks.
const game = vi.hoisted(() => ({ finishWith: { tapsMs: [3200] } as TimeBankInputs }));
vi.mock("@/components/inner-clock/TimeBankGame", () => ({
  TimeBankGame: ({ onFinish }: { onFinish: (inputs: TimeBankInputs) => void }) => (
    <button type="button" onClick={() => onFinish(game.finishWith)}>
      Fake run
    </button>
  ),
}));
// Fixed rounds: targets 15, 18, 21 and 24 s with a 10 s bank.
vi.mock("@/lib/random", () => ({ secureRandomSeed: () => 0 }));
vi.mock("@/challenges/inner-clock/timeBank", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/inner-clock/timeBank")>();
  const rounds = [15_000, 18_000, 21_000, 24_000].map((targetMs) => ({ targetMs, revealMs: 2000, timeoutMs: targetMs + 10_000 }));
  return { ...real, paramsFromSeed: () => ({ budgetMs: 10_000, rounds }) };
});

import { InnerClockPractice } from "./InnerClockPractice";

afterEach(cleanup);

async function playWith(inputs: TimeBankInputs) {
  game.finishWith = inputs;
  const user = userEvent.setup();
  render(<InnerClockPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake run" }));
  return user;
}

describe("InnerClockPractice", () => {
  it("explains the time bank and shows the first target before the start", () => {
    render(<InnerClockPractice />);
    expect(screen.getByText(/targets? time \(10 to 20 seconds\).*2-second time bank/)).toBeTruthy();
    expect(screen.getByText("First target: 15 seconds")).toBeTruthy();
  });

  it("shows the rounds survived and the bank left once a miss empties it, and focuses the result", async () => {
    await playWith({ tapsMs: [16_200, 30_000] });
    const heading = screen.getByRole("heading", { name: "1 round survived" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("0 s of your 10 s time bank left. Score: 1.")).toBeTruthy();
  });

  it("says so when every round survives, with the bank left", async () => {
    await playWith({ tapsMs: [15_100, 18_100, 21_100, 24_100] });
    expect(screen.getByRole("heading", { name: "Every round survived" })).toBeTruthy();
    expect(screen.getByText("9.6 s of your 10 s time bank left. Score: 4.96.")).toBeTruthy();
  });

  it("counts a first round that timed out as none survived", async () => {
    await playWith({ tapsMs: [null] });
    expect(screen.getByRole("heading", { name: "0 rounds survived" })).toBeTruthy();
  });

  it("offers another go, which starts a new run", async () => {
    const user = await playWith({ tapsMs: [null] });
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });
});
