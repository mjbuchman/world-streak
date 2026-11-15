// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUND_GAP_MS, TIMEOUT_FACTOR, type TimeBankParams } from "@/challenges/inner-clock/timeBank";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import type { InnerClockGame } from "./InnerClockGame";
import { TimeBankGame } from "./TimeBankGame";

// The round itself (the tap, its clock, its timeout and the hidden-tab rule) is InnerClockGame's,
// tested on its own; here a stand-in records what each round is given.
type RoundProps = ComponentProps<typeof InnerClockGame>;
let round: RoundProps | null;
let mounts: number;
vi.mock("./InnerClockGame", async (importOriginal) => {
  const { useEffect } = await import("react");
  return {
    ...(await importOriginal<object>()),
    InnerClockGame: (props: RoundProps) => {
      round = props;
      useEffect(() => void mounts++, []);
      return <p>Round on screen</p>;
    },
  };
});

const params: TimeBankParams = {
  budgetMs: 3000,
  rounds: [3000, 4000, 5000].map((targetMs, i) => ({ targetMs, revealMs: 1000 - 100 * i, timeoutMs: TIMEOUT_FACTOR * targetMs })),
};

const tap = (tapMs: number | null) => act(() => round!.onFinish({ tapMs }));
const gap = () => act(() => void vi.advanceTimersByTime(ROUND_GAP_MS));
const budget = () => screen.getByRole("meter", { name: "Error budget left" });

beforeEach(() => {
  round = null;
  mounts = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TimeBankGame", () => {
  it("plays round 1 after the 3-2-1, and later rounds without it, each with its own target, clock and timeout", () => {
    render(<TimeBankGame params={params} onFinish={vi.fn()} />);
    expect(screen.getByText("Round 1 of 3")).toBeTruthy();
    expect(round).toMatchObject({ params: params.rounds[0], revealMs: 1000, countdownMs: RUN_COUNTDOWN_MS });
    tap(3200);
    gap();
    expect(screen.getByText("Round 2 of 3")).toBeTruthy();
    // Its own timeout, so the hidden-tab rule (T110) ends this round at 12 s, not round 1's 9 s.
    expect(round).toMatchObject({ params: params.rounds[1], revealMs: 900, countdownMs: 0 });
    expect(mounts).toBe(2);
  });

  it("shows each round's error for the gap, draining the budget by it, then the next round", () => {
    render(<TimeBankGame params={params} onFinish={vi.fn()} />);
    expect(budget().getAttribute("aria-valuenow")).toBe("3000");
    expect(budget().getAttribute("aria-valuetext")).toBe("3 s of 3 s left");
    tap(3200);
    expect(screen.getByText("0.2 s late")).toBeTruthy();
    expect(screen.queryByText("Round on screen")).toBeNull();
    expect(budget().getAttribute("aria-valuenow")).toBe("2800");
    expect(budget().getAttribute("aria-valuetext")).toBe("2.8 s of 3 s left");
    act(() => void vi.advanceTimersByTime(ROUND_GAP_MS - 1));
    expect(screen.queryByText("Round on screen")).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByText("Round on screen")).toBeTruthy();
    expect(screen.queryByText("0.2 s late")).toBeNull();
  });

  it.each([
    [3000, "Spot on"],
    [2650, "0.35 s early"],
    [null, "Time ran out"],
  ])("says a tap at %s as %s", (tapMs, label) => {
    render(<TimeBankGame params={{ ...params, budgetMs: 10_000 }} onFinish={vi.fn()} />);
    tap(tapMs);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("reports the taps once the round that empties the budget ends the run", () => {
    const onFinish = vi.fn();
    render(<TimeBankGame params={params} onFinish={onFinish} />);
    tap(3200);
    gap();
    expect(onFinish).not.toHaveBeenCalled();
    // Error 4,000 with 2,800 left.
    tap(8000);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ tapsMs: [3200, 8000] });
    expect(budget().getAttribute("aria-valuenow")).toBe("0");
    // No further round starts.
    gap();
    expect(screen.queryByText("Round on screen")).toBeNull();
  });

  it("reports the taps after the last round when the budget lasts", () => {
    const onFinish = vi.fn();
    render(<TimeBankGame params={params} onFinish={onFinish} />);
    tap(3100);
    gap();
    tap(4100);
    gap();
    expect(onFinish).not.toHaveBeenCalled();
    tap(5100);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ tapsMs: [3100, 4100, 5100] });
  });

  it("passes a custom countdown to round 1 (0 skips it in tests of the run)", () => {
    render(<TimeBankGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(round?.countdownMs).toBe(0);
  });
});
