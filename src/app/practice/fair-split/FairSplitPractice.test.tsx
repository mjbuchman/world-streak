// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GAP_MS, ROUND_COUNTDOWN_MS, type FairSplitCut, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";

// Every run: two squares, 3 s each, against an 8-point bank.
const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const params: FairSplitParams = { bank: 8, shapes: [0, 1].map(() => ({ polygon: SQUARE, limitMs: 3000 })) };
vi.mock("@/challenges/fair-split/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/fair-split/engine")>();
  return { ...real, paramsFromSeed: () => params };
});
// The game has its own tests; here a stand-in finishes with whatever run the test asks.
const game = vi.hoisted(() => ({ inputs: { cuts: [], endMs: 0 } as FairSplitInputs }));
vi.mock("@/components/fair-split/FairSplitGame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/fair-split/FairSplitGame")>()),
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

/** A vertical cut at x, `atMs` from the start: x = 51 is 1 point off half. */
const cutAt = (atMs: number, x = 50): FairSplitCut => ({ atMs, ax: x, ay: 0, bx: x, by: 100 });
const FIRST = ROUND_COUNTDOWN_MS + 1000;

describe("FairSplitPractice", () => {
  it("explains the line, the Cut button and the bank before the start", () => {
    render(<FairSplitPractice />);
    expect(screen.getByText(/^Press Start for five shapes, irregular blobs and polygons, each one lopsided.*then press Cut or Enter.*one 8-point bank/)).toBeTruthy();
  });

  it("shows the shapes survived and the bank left, and focuses the result", async () => {
    // A cut 1.2 points off, then one 7 points off: more than the 6.8 left, so the bank is gone.
    await playWith({ cuts: [cutAt(FIRST, 51.2), cutAt(FIRST + GAP_MS + 500, 57)], endMs: FIRST + GAP_MS + 500 });
    const heading = screen.getByRole("heading", { name: "1 shape survived" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("0 points of your 8-point bank left.")).toBeTruthy();
  });

  it("says so when every shape survives, and when none does", async () => {
    await playWith({ cuts: [cutAt(FIRST), cutAt(FIRST + GAP_MS + 500, 51)], endMs: FIRST + GAP_MS + 500 });
    expect(screen.getByRole("heading", { name: "Every shape survived" })).toBeTruthy();
    expect(screen.getByText("7 points of your 8-point bank left.")).toBeTruthy();
    cleanup();
    const user = await playWith({ cuts: [], endMs: 60_000 });
    expect(screen.getByRole("heading", { name: "0 shapes survived" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });
});
