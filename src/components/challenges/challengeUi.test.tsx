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
vi.mock("@/components/inner-clock/TimeBankGame", () => ({
  TimeBankGame: ({ onFinish }: { onFinish: (inputs: { tapsMs: number[] }) => void }) => (
    <button type="button" onClick={() => onFinish({ tapsMs: [3200, 4100] })}>
      Clock
    </button>
  ),
}));
vi.mock("@/components/flash-count/FlashLadderGame", () => ({
  FlashLadderGame: ({ onFinish }: { onFinish: (inputs: { answers: { count: number; atMs: number }[] }) => void }) => (
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

  it("explains Second Sense's rounds and time bank (T140)", () => {
    expect(challengeUi("inner-clock").howTo).toMatch(/round.*3-second time bank.*Survive as many rounds/);
  });

  it("explains Swift Sum's levels and lives (T142)", () => {
    expect(challengeUi("flash-count").howTo).toMatch(/level.*3 lives.*same level/);
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
    ["inner-clock", 3.9, 4, "You scored 3.9 rounds. Today's target was 4 rounds."],
    ["inner-clock", 1, 4, "You scored 1 round. Today's target was 4 rounds."],
    ["flash-count", 4.667, 5, "You scored 4.667 levels. Today's target was 5 levels."],
    ["flash-count", 1, 5, "You scored 1 level. Today's target was 5 levels."],
    ["echo-path", 5.667, 6, "You scored 5.667 steps. Today's target was 6 steps."],
    ["echo-path", 1, 6, "You scored 1 step. Today's target was 6 steps."],
    ["fair-split", 6.333, 5, "You scored 6.333 shapes. Today's target was 5 shapes."],
    ["fair-split", 1, 5, "You scored 1 shape. Today's target was 5 shapes."],
  ] as const)("sums up a %s result against today's target", (type, score, target, line) => {
    expect(challengeUi(type).summary(score, target)).toBe(line);
  });
});
