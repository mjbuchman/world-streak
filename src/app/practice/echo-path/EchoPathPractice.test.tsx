// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sequenceFor, type EchoPathInputs, type EchoPathParams } from "@/challenges/echo-path/engine";

// Every run: a 6-tile path (shorter than any real one, so a test can clear it all), from a start of 4.
const params: EchoPathParams = { cols: 5, rows: 8, path: [2, 7, 12, 17, 22, 27], startLength: 4, stepMs: 350 };
vi.mock("@/challenges/echo-path/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges/echo-path/engine")>();
  return { ...real, paramsFromSeed: () => params };
});
// The game has its own tests; here a stand-in finishes with whatever tiles the test asks.
const game = vi.hoisted(() => ({ tiles: [] as number[] }));
vi.mock("@/components/echo-path/EchoPathGame", () => ({
  EchoPathGame: ({ onFinish }: { onFinish: (inputs: EchoPathInputs) => void }) => (
    <button type="button" onClick={() => onFinish({ taps: game.tiles.map((tile, i) => ({ tile, atMs: 1000 * (i + 1) })) })}>
      Fake run
    </button>
  ),
}));

import { EchoPathPractice } from "./EchoPathPractice";

afterEach(cleanup);

async function playWith(tiles: number[]) {
  game.tiles = tiles;
  const user = userEvent.setup();
  render(<EchoPathPractice />);
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("button", { name: "Fake run" }));
  return user;
}

/** A first tap that is wrong: the path's first tile is never its second. */
const WRONG = 7;

describe("EchoPathPractice", () => {
  it("explains the path, the keys and the lives before the start", () => {
    render(<EchoPathPractice />);
    expect(screen.getByText(/a path of 4 tiles lights up from the bottom of the board.*arrow keys.*until it reaches the top: a path of up to 12 tiles.*3 lives/)).toBeTruthy();
  });

  it("shows the longest path against the whole and the lives left, and focuses the result", async () => {
    await playWith([...sequenceFor(params, 4), WRONG, WRONG, WRONG]);
    const heading = screen.getByRole("heading", { name: "Longest path: 4 of 6 tiles" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("0 of 3 lives left. Score: 4.")).toBeTruthy();
  });

  it("says so when the path reaches the top, and when no path is repeated", async () => {
    await playWith([...sequenceFor(params, 4), WRONG, ...sequenceFor(params, 5), ...sequenceFor(params, 6)]);
    expect(screen.getByRole("heading", { name: "You reached the top: 6 tiles" })).toBeTruthy();
    expect(screen.getByText("2 of 3 lives left. Score: 6.667.")).toBeTruthy();
    cleanup();
    const user = await playWith([WRONG, WRONG, WRONG]);
    expect(screen.getByRole("heading", { name: "No path repeated" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });
});
