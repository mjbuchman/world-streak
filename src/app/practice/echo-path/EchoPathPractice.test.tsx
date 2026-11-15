// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sequenceFor, type EchoPathInputs, type EchoPathParams } from "@/challenges/echo-path/engine";

// Every run: lengths 3 to 4 on a fixed seed.
const params: EchoPathParams = { cols: 3, rows: 3, startLength: 3, maxLength: 4, stepMs: 400, sequenceSeed: 21 };
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

const wrong = (length: number, tryIndex: number) => (sequenceFor(params, length, tryIndex)[0] + 1) % 9;

describe("EchoPathPractice", () => {
  it("explains the paths and lives before the start", () => {
    render(<EchoPathPractice />);
    expect(screen.getByText(/tiles on the grid light up/)).toBeTruthy();
  });

  it("shows the longest path and the lives left, and focuses the result", async () => {
    await playWith([...sequenceFor(params, 3, 0), wrong(4, 0), wrong(4, 1), wrong(4, 2)]);
    const heading = screen.getByRole("heading", { name: "Longest path: 3 tiles" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("0 of 3 lives left. Score: 3.")).toBeTruthy();
  });

  it("says so when every path is repeated, and when none is", async () => {
    await playWith([...sequenceFor(params, 3, 0), ...sequenceFor(params, 4, 0)]);
    expect(screen.getByRole("heading", { name: "Every path repeated" })).toBeTruthy();
    expect(screen.getByText("3 of 3 lives left. Score: 5.")).toBeTruthy();
    cleanup();
    const user = await playWith([wrong(3, 0), wrong(3, 1), wrong(3, 2)]);
    expect(screen.getByRole("heading", { name: "No path repeated" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Fake run" })).toBeTruthy();
  });
});
