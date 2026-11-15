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
vi.mock("@/components/flash-count/FlashCountGame", () => ({
  FlashCountGame: ({ onFinish }: { onFinish: (inputs: { count: number }) => void }) => (
    <button type="button" onClick={() => onFinish({ count: 20 })}>
      Dots
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

  it.each([
    ["stacking", "Tower", { tapsMs: [900, 1800] }],
    ["inner-clock", "Clock", { tapsMs: [3200, 4100] }],
    ["flash-count", "Dots", { count: 20 }],
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
    ["flash-count", 12, 15, "You were 12% off. Today's target was within 15%."],
  ] as const)("sums up a %s result against today's target", (type, score, target, line) => {
    expect(challengeUi(type).summary(score, target)).toBe(line);
  });
});
