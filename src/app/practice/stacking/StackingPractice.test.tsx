// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { paramsFromSeed, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";

type GameProps = { params: StackingParams; onFinish: (run: { taps: number[]; result: StackingResult }) => void };
const games = vi.hoisted(() => [] as GameProps[]);
vi.mock("@/components/stacking/StackingGame", () => ({
  StackingGame: (props: GameProps) => {
    games.push(props);
    return <div data-testid="game" />;
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
      result: { score, blocks: [], endedAtMs: 1000, endReason: "miss", moving: null },
    }),
  );

describe("StackingPractice", () => {
  it("explains the game and waits for Start", () => {
    render(<StackingPractice />);
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
    await userEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(games.at(-1)!.params).toEqual(paramsFromSeed(22));
  });

  it("says block, not blocks, for a score of 1", async () => {
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(1);
    expect(screen.getByRole("heading", { name: "You stacked 1 block" })).toBeTruthy();
  });

  it("never contacts the server", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<StackingPractice />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    finish(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
