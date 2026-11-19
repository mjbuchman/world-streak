// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHALLENGE_TYPES } from "@/challenges/shared/types";

// The games have their own tests; here stand-ins finish with fixed raw results.
vi.mock("@/components/stacking/StackingGame", () => ({
  StackingGame: ({ onFinish }: { onFinish: (run: { taps: number[] }) => void }) => (
    <button type="button" onClick={() => onFinish({ taps: [900, 1800] })}>
      Tower
    </button>
  ),
}));
vi.mock("@/components/inner-clock/InnerClockGame", () => ({
  InnerClockGame: ({ onFinish }: { onFinish: (inputs: { tapsMs: number[] }) => void }) => (
    <button type="button" onClick={() => onFinish({ tapsMs: [3200, 4100] })}>
      Clock
    </button>
  ),
}));
vi.mock("@/components/flash-count/FlashCountGame", () => ({
  FlashCountGame: ({ onFinish }: { onFinish: (inputs: { answers: { count: number; atMs: number }[] }) => void }) => (
    <button type="button" onClick={() => onFinish({ answers: [{ count: 20, atMs: 4000 }] })}>
      Dots
    </button>
  ),
}));

vi.mock("@/components/fair-split/FairSplitGame", () => ({
  FairSplitGame: ({ onFinish }: { onFinish: (inputs: { cuts: unknown[]; endMs: number }) => void }) => (
    <button type="button" onClick={() => onFinish({ cuts: [], endMs: 9000 })}>
      Shapes
    </button>
  ),
}));

vi.mock("@/components/echo-path/EchoPathGame", () => ({
  EchoPathGame: ({ onFinish }: { onFinish: (inputs: { taps: { tile: number; atMs: number }[] }) => void }) => (
    <button type="button" onClick={() => onFinish({ taps: [{ tile: 4, atMs: 3000 }] })}>
      Tiles
    </button>
  ),
}));

import { challengeUi } from "./challengeUi";

afterEach(cleanup);

describe("challengeUi", () => {
  it("has screens, a how-to and a practice page for every challenge type", () => {
    for (const type of CHALLENGE_TYPES) {
      const ui = challengeUi(type);
      expect(ui.howTo.length).toBeGreaterThan(20);
      expect(ui.practicePath).toBe(`/practice/${type}`);
    }
  });

  it("explains Second Sense's four rounds, 10 to 20 second targets and 2-second time bank (T183, T203)", () => {
    expect(challengeUi("inner-clock").howTo).toMatch(/four rounds.*10 to 20 seconds.*2-second time bank.*Survive all four/);
  });

  it("calls a Second Sense target of 4 surviving all four rounds, and any other target plain rounds", () => {
    expect(challengeUi("inner-clock").target(4)).toBe("4 rounds: survive all four");
    expect(challengeUi("inner-clock").target(4.5)).toBe("4.5 rounds");
  });

  it("explains Swift Sum's five rounds and its dot bank (T186)", () => {
    expect(challengeUi("flash-count").howTo).toMatch(/five rounds.*a new count of 10 to 30 dots.*10-dot bank.*Survive all five/);
  });

  it("explains Echo Path's climbing path and its arrow keys, and states its target as a path length (T190, T191)", () => {
    expect(challengeUi("echo-path").howTo).toMatch(/path of 4 tiles.*arrow keys.*Space or Enter.*reaches the top: a path of up to 12 tiles.*3 lives/);
    expect(challengeUi("echo-path").target(10)).toBe("a path of 10 tiles");
  });

  it.each([
    ["stacking", "Tower", { tapsMs: [900, 1800] }],
    ["inner-clock", "Clock", { tapsMs: [3200, 4100] }],
    ["flash-count", "Dots", { answers: [{ count: 20, atMs: 4000 }] }],
    ["echo-path", "Tiles", { taps: [{ tile: 4, atMs: 3000 }] }],
    ["fair-split", "Shapes", { cuts: [], endMs: 9000 }],
  ] as const)("plays %s and hands on exactly the inputs its submit expects", (type, button, inputs) => {
    const onFinish = vi.fn();
    render(<>{challengeUi(type).play({ params: {}, passTarget: 1, onFinish })}</>);
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(inputs);
  });

  it.each([
    ["stacking", 7, 10, "You reached row 7. Today's target was row 10."],
    ["inner-clock", 3.9, 4, "You scored 3.9 rounds. Today's target was 4 rounds: survive all four."],
    ["inner-clock", 1, 4.5, "You scored 1 round. Today's target was 4.5 rounds."],
    ["flash-count", 5.4, 5, "You scored 5.4 rounds. Today's target was 5 rounds: survive all five."],
    ["flash-count", 1, 4, "You scored 1 round. Today's target was 4 rounds."],
    ["echo-path", 7.667, 10, "You scored 7.667 tiles. Today's target was a path of 10 tiles."],
    ["echo-path", 1, 10, "You scored 1 tile. Today's target was a path of 10 tiles."],
    ["fair-split", 5.5, 5, "You scored 5.5 shapes. Today's target was 5 shapes: survive all five."],
    ["fair-split", 1, 4, "You scored 1 shape. Today's target was 4 shapes."],
  ] as const)("sums up a %s result against today's target", (type, score, target, line) => {
    expect(challengeUi(type).summary(score, target)).toBe(line);
  });
});
