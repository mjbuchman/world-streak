// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { COUNTDOWN_STEP_MS, RUN_COUNTDOWN_MS } from "@/config/countdown";
import { CountdownNumber, countdownNumber } from "./CountdownNumber";

afterEach(cleanup);

describe("countdownNumber", () => {
  it.each([
    [0, 3],
    [COUNTDOWN_STEP_MS - 1, 3],
    [COUNTDOWN_STEP_MS, 2],
    [2 * COUNTDOWN_STEP_MS, 1],
    [RUN_COUNTDOWN_MS - 1, 1],
    [RUN_COUNTDOWN_MS, null],
    [RUN_COUNTDOWN_MS + 5_000, null],
  ])("at %i ms into the 3-2-1 shows %s", (elapsedMs, shown) => {
    expect(countdownNumber(elapsedMs)).toBe(shown);
  });

  it("shows nothing for a countdown of 0 ms", () => {
    expect(countdownNumber(0, 0)).toBeNull();
  });
});

describe("CountdownNumber", () => {
  it("shows the number, hidden from screen readers (the game's own label says to get ready)", () => {
    const { container } = render(<CountdownNumber value={2} />);
    const number = container.querySelector("[data-countdown]");
    expect(number?.textContent).toBe("2");
    expect(number?.getAttribute("aria-hidden")).toBe("true");
  });
});
