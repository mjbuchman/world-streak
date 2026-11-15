// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlashLadderInputs } from "@/challenges/flash-count/flashLadder";

// The game has its own tests; here a stand-in finishes with whatever the test asks.
const game = vi.hoisted(() => ({ counts: [10] }));
vi.mock("@/components/flash-count/FlashLadderGame", () => ({
  FlashLadderGame: ({ onFinish }: { onFinish: (inputs: FlashLadderInputs) => void }) => (
    <button type="button" onClick={() => onFinish({ answers: game.counts.map((count, i) => ({ count, atMs: 1000 * (i + 1) })) })}>
      Fake run
    </button>
  ),
}));
// Every run has two levels, of 10 and 14 dots.
vi.mock("@/challenges/flash-count/flashLadder", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/flash-count/flashLadder")>();
  return { ...real, paramsFromSeed: () => ({ layoutSeed: 1, levels: [10, 14].map((dotCount) => ({ dotCount, flashMs: 1500 })) }) };
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
  it("explains the levels and lives before the start", () => {
    render(<FlashCountPractice />);
    expect(screen.getByText(/3 lives/)).toBeTruthy();
  });

  it("shows the levels cleared and lives left once the lives run out, and focuses the result", async () => {
    await playWith(10, 1, 2, 3);
    const heading = screen.getByRole("heading", { name: "1 level cleared" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("0 of 3 lives left. Score: 1.")).toBeTruthy();
  });

  it("says so when every level is cleared", async () => {
    await playWith(10, 20, 14);
    expect(screen.getByRole("heading", { name: "Every level cleared" })).toBeTruthy();
    expect(screen.getByText("2 of 3 lives left. Score: 2.667.")).toBeTruthy();
  });

  it("offers another go", async () => {
    const user = await playWith(1, 2, 3);
    expect(screen.getByRole("heading", { name: "0 levels cleared" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });
});
