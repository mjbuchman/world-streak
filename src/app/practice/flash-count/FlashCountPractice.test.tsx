// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlashCountInputs } from "@/challenges/flash-count/engine";

// The game has its own tests; here a stand-in answers with whatever the test asks.
const game = vi.hoisted(() => ({ answer: 20 }));
vi.mock("@/components/flash-count/FlashCountGame", () => ({
  FlashCountGame: ({ onFinish }: { onFinish: (inputs: FlashCountInputs) => void }) => (
    <button type="button" onClick={() => onFinish({ count: game.answer })}>
      Fake answer
    </button>
  ),
}));
// Every run has 25 dots.
vi.mock("@/challenges/flash-count/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/flash-count/engine")>();
  return { ...real, paramsFromSeed: () => ({ dotCount: 25, flashMs: 1000, dots: [] }) };
});

import { FlashCountPractice } from "./FlashCountPractice";

afterEach(cleanup);

async function answer(count: number) {
  game.answer = count;
  const user = userEvent.setup();
  render(<FlashCountPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake answer" }));
  return user;
}

describe("FlashCountPractice", () => {
  it("explains the game before the start", () => {
    render(<FlashCountPractice />);
    expect(screen.getByText(/dots flash on the board for one second/)).toBeTruthy();
  });

  it("reveals the true count and the error, and focuses the result", async () => {
    await answer(22);
    const heading = screen.getByRole("heading", { name: "12% off" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("You said 22. There were 25 dots.")).toBeTruthy();
  });

  it("says exactly right for the true count", async () => {
    await answer(25);
    expect(screen.getByRole("heading", { name: "Exactly right" })).toBeTruthy();
  });

  it("offers another go", async () => {
    const user = await answer(30);
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake answer" })).toBeTruthy();
  });
});
