// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InnerClockInputs } from "@/challenges/inner-clock/engine";

// The game itself has its own tests; here a stand-in finishes with whatever the test asks.
const game = vi.hoisted(() => ({ finishWith: { tapMs: 5320 } as InnerClockInputs }));
vi.mock("@/components/inner-clock/InnerClockGame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/inner-clock/InnerClockGame")>()),
  InnerClockGame: ({ onFinish }: { onFinish: (inputs: InnerClockInputs) => void }) => (
    <button type="button" onClick={() => onFinish(game.finishWith)}>
      Fake tap
    </button>
  ),
}));
// A fixed seed whose target is 5,000 ms.
vi.mock("@/lib/random", () => ({ secureRandomSeed: () => 0 }));
vi.mock("@/challenges/inner-clock/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/inner-clock/engine")>();
  return { ...real, paramsFromSeed: () => ({ targetMs: 5000, timeoutMs: 15_000 }) };
});

import { InnerClockPractice } from "./InnerClockPractice";

afterEach(cleanup);

async function playWith(inputs: InnerClockInputs) {
  game.finishWith = inputs;
  const user = userEvent.setup();
  render(<InnerClockPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake tap" }));
  return user;
}

describe("InnerClockPractice", () => {
  it("explains the game and shows the target before the start", () => {
    render(<InnerClockPractice />);
    expect(screen.getByText(/tap when you think the target time has passed/)).toBeTruthy();
    expect(screen.getByText("Your target: 5 seconds")).toBeTruthy();
  });

  it("reveals the actual time and the error after a late tap, and focuses the result", async () => {
    await playWith({ tapMs: 5320 });
    const heading = screen.getByRole("heading", { name: "0.32 s late" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("You tapped at 5.32 s. The target was 5 s.")).toBeTruthy();
  });

  it("says early for an early tap, and spot on for an exact one", async () => {
    await playWith({ tapMs: 4700 });
    expect(screen.getByRole("heading", { name: "0.3 s early" })).toBeTruthy();
    cleanup();
    await playWith({ tapMs: 5000.2 });
    expect(screen.getByRole("heading", { name: "Spot on" })).toBeTruthy();
  });

  it("explains a run that timed out without a tap", async () => {
    await playWith({ tapMs: null });
    expect(screen.getByRole("heading", { name: "Time ran out" })).toBeTruthy();
    expect(screen.getByText("No tap within 15 s, so it counts as 10 s off.")).toBeTruthy();
  });

  it("treats a tap after the timeout as no tap, as the engine does", async () => {
    await playWith({ tapMs: 15_001 });
    expect(screen.getByRole("heading", { name: "Time ran out" })).toBeTruthy();
  });

  it("offers another go, which starts a new run", async () => {
    const user = await playWith({ tapMs: 5320 });
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake tap" })).toBeTruthy();
  });
});
