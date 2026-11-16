// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GAP_MS, type FairSplitCut, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";

// Every run: two squares, 3 s each.
const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const params: FairSplitParams = { shapes: [0, 1].map(() => ({ polygon: SQUARE, limitMs: 3000 })) };
vi.mock("@/challenges/fair-split/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/fair-split/engine")>();
  return { ...real, paramsFromSeed: () => params };
});
// The game has its own tests; here a stand-in finishes with whatever run the test asks.
const game = vi.hoisted(() => ({ inputs: { cuts: [], endMs: 0 } as FairSplitInputs }));
vi.mock("@/components/fair-split/FairSplitGame", () => ({
  FairSplitGame: ({ onFinish }: { onFinish: (inputs: FairSplitInputs) => void }) => (
    <button type="button" onClick={() => onFinish(game.inputs)}>
      Fake run
    </button>
  ),
}));

import { FairSplitPractice } from "./FairSplitPractice";

afterEach(cleanup);

async function playWith(inputs: FairSplitInputs) {
  game.inputs = inputs;
  const user = userEvent.setup();
  render(<FairSplitPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake run" }));
  return user;
}

const half = (atMs: number): FairSplitCut => ({ atMs, ax: 50, ay: 0, bx: 50, by: 100 });

describe("FairSplitPractice", () => {
  it("explains the cut and the lives before the start", () => {
    render(<FairSplitPractice />);
    expect(screen.getByText(/Drag one straight line across it/)).toBeTruthy();
  });

  it("shows the shapes cut and the lives left, and focuses the result", async () => {
    // One fair cut, then the second square times out three times.
    await playWith({ cuts: [half(1000)], endMs: 60_000 });
    const heading = screen.getByRole("heading", { name: "Shapes cut: 1" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("0 of 3 lives left. Score: 1.")).toBeTruthy();
  });

  it("says so when every shape is cut, and when none is", async () => {
    await playWith({ cuts: [half(1000), half(1000 + GAP_MS + 500)], endMs: 1000 + GAP_MS + 500 });
    expect(screen.getByRole("heading", { name: "Every shape cut" })).toBeTruthy();
    expect(screen.getByText("3 of 3 lives left. Score: 3.")).toBeTruthy();
    cleanup();
    const user = await playWith({ cuts: [], endMs: 60_000 });
    expect(screen.getByRole("heading", { name: "No shape cut" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });
});
