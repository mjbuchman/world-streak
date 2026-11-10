// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { paramsFromSeed, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";

type GameProps = {
  params: StackingParams;
  onFinish: (run: { taps: number[]; result: StackingResult }) => void;
  best?: number;
};
const games = vi.hoisted(() => [] as GameProps[]);
vi.mock("@/components/stacking/StackingGame", () => ({
  StackingGame: (props: GameProps) => {
    games.push(props);
    // Like the real game, it takes focus when it mounts (tested in StackingGame.test.tsx).
    return <div data-testid="game" tabIndex={-1} ref={(element) => element?.focus()} />;
  },
}));

import { StackingPractice } from "./StackingPractice";

afterEach(() => {
  cleanup();
  games.length = 0;
  vi.restoreAllMocks();
});

/** Makes the browser's random seeds come out as these values, in order. */
function stubSeeds(...seeds: number[]) {
  const fill = (array: Uint32Array) => {
    array[0] = seeds.shift()!;
    return array;
  };
  vi.spyOn(crypto, "getRandomValues").mockImplementation(fill as typeof crypto.getRandomValues);
}

const finish = (score: number) =>
  act(() =>
    games.at(-1)!.onFinish({
      taps: [],
      result: { score, rows: [], endedAtMs: 1000, endReason: "miss", moving: null },
    }),
  );

describe("StackingPractice", () => {
  it("shows the score as the result's big number", async () => {
    const { container } = render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(7);
    expect(container.querySelector("[data-big-score]")?.textContent).toBe("7");
  });

  it("explains the game and waits for Start", () => {
    render(<StackingPractice />);
    // The same wording as before the how-to moved to config (T71).
    expect(
      screen.getByText(
        "A row of blocks slides across the board. Tap, click or press Space to lock it over the row below. Blocks that hang over the edge fall off, so the tower gets narrower. Practice never counts.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/never counts/)).toBeTruthy();
    expect(screen.queryByTestId("game")).toBeNull();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("starts a run from a fresh random seed", async () => {
    stubSeeds(1234);
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByTestId("game")).toBeTruthy();
    expect(games.at(-1)!.params).toEqual(paramsFromSeed(1234));
  });

  it("shows the score on finish and plays again with a new seed", async () => {
    stubSeeds(11, 22);
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(7);

    expect(screen.getByRole("heading", { name: "You stacked 7 blocks" })).toBeTruthy();
    expect(screen.queryByTestId("game")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    await userEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(games.at(-1)!.params).toEqual(paramsFromSeed(22));
  });

  it("carries the best row of this visit into each new run", async () => {
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(games.at(-1)!.best).toBe(0);
    finish(7);
    await userEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(games.at(-1)!.best).toBe(7);
    // A worse run keeps the best.
    finish(3);
    await userEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(games.at(-1)!.best).toBe(7);
  });

  it("moves focus to the result when a run ends, so it is announced and Space cannot restart", async () => {
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(4);

    const heading = screen.getByRole("heading", { name: "You stacked 4 blocks" });
    expect(document.activeElement).toBe(heading);

    // A Space still held from the last drop, or pressed again, lands on the heading: no new run.
    const runs = games.length;
    await userEvent.keyboard(" ");
    expect(games.length).toBe(runs);
    expect(screen.queryByTestId("game")).toBeNull();

    // Tab reaches Play again.
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Play again" }));
  });

  it("hands focus to the game on Play again, and back to the new result when that run ends", async () => {
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(4);
    await userEvent.click(screen.getByRole("button", { name: "Play again" }));

    // The button is gone; focus is on the new game, not left on <body>.
    expect(document.activeElement).toBe(screen.getByTestId("game"));

    finish(6);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "You stacked 6 blocks" }));
  });

  it("says block, not blocks, for a score of 1", async () => {
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(1);
    expect(screen.getByRole("heading", { name: "You stacked 1 block" })).toBeTruthy();
  });

  it("does not fetch anything itself (the e2e test guards the real game)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
