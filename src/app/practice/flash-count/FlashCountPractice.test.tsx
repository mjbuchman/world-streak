// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlashCountInputs } from "@/challenges/flash-count/engine";

// The game has its own tests; here a stand-in finishes with whatever the test asks.
const game = vi.hoisted(() => ({ counts: [10] }));
vi.mock("@/components/flash-count/FlashCountGame", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  FlashCountGame: ({ onFinish }: { onFinish: (inputs: FlashCountInputs) => void }) => (
    <button type="button" onClick={() => onFinish({ answers: game.counts.map((count, i) => ({ count, atMs: 1000 * (i + 1) })) })}>
      Fake run
    </button>
  ),
}));
// Every run has two rounds, of 10 and 14 dots, against a 10-dot bank.
vi.mock("@/challenges/flash-count/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/flash-count/engine")>();
  return { ...real, paramsFromSeed: () => ({ layoutSeed: 1, bank: 10, levels: [10, 14].map((dotCount) => ({ dotCount, flashMs: 1500 })) }) };
});

import { FlashCountPractice } from "./FlashCountPractice";

afterEach(cleanup);

async function playWith(...counts: number[]) {
  game.counts = counts;
  const user = userEvent.setup();
  render(<FlashCountPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake run" }));
  return user;
}

describe("FlashCountPractice", () => {
  it("explains the rounds and the dot bank before the start", () => {
    render(<FlashCountPractice />);
    expect(screen.getByText(/five rounds/)).toBeTruthy();
    expect(screen.getByText(/10-dot bank/)).toBeTruthy();
  });

  it("shows the rounds survived and the bank left once it is bust, and focuses the result", async () => {
    await playWith(13, 22);
    const heading = screen.getByRole("heading", { name: "1 round survived" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("0 dots of your 10-dot bank left. Score: 1.")).toBeTruthy();
  });

  it("says so when every round is survived", async () => {
    await playWith(9, 16);
    expect(screen.getByRole("heading", { name: "Every round survived" })).toBeTruthy();
    expect(screen.getByText("7 dots of your 10-dot bank left. Score: 2.7.")).toBeTruthy();
  });

  it("offers another go", async () => {
    const user = await playWith(30);
    expect(screen.getByRole("heading", { name: "0 rounds survived" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });
});
