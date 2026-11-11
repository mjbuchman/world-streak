// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown, formatCountdown } from "./Countdown";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe("Countdown", () => {
  it("counts down to today's deadline every second", async () => {
    vi.setSystemTime(new Date("2026-11-08T18:00:00Z"));
    render(<Countdown />);
    await advance(0);
    expect(screen.getByRole("timer").textContent).toBe("Closes in 6:00:00");
    await advance(1_000);
    expect(screen.getByRole("timer").textContent).toBe("Closes in 5:59:59");
  });

  it("rolls over to the next day's deadline at midnight UTC", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:59:59Z"));
    render(<Countdown />);
    await advance(0);
    expect(screen.getByRole("timer").textContent).toBe("Closes in 0:00:01");
    await advance(1_000);
    expect(screen.getByRole("timer").textContent).toBe("Closes in 24:00:00");
  });

  it("renders no time on the server, so the first browser render matches it", () => {
    expect(renderToString(<Countdown />)).toMatch(/<p[^>]*role="timer"[^>]*><\/p>/);
  });
});

describe("formatCountdown", () => {
  it.each([
    [0, "0:00:00"],
    [-5_000, "0:00:00"],
    [999, "0:00:00"],
    [61_000, "0:01:01"],
    [36_000_000, "10:00:00"],
  ])("formats %i ms as %s", (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
