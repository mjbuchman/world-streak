// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUND_COUNTDOWN_MS, ROUND_GAP_MS, type TimeBankParams } from "@/challenges/inner-clock/timeBank";
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

// Frames from fake timers: performance.now and requestAnimationFrame both follow them.
const params: TimeBankParams = {
  budgetMs: 10_000,
  rounds: [15_000, 18_000, 21_000, 24_000].map((targetMs) => ({ targetMs, revealMs: 2000, timeoutMs: targetMs + 10_000 })),
};

const tap = (tapMs: number | null) => act(() => round!.onFinish({ tapMs }));
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
/** The 3-2-1, run out (a few frames past its end). */
const countdown = () => wait(ROUND_COUNTDOWN_MS + 100);
const gap = () => wait(ROUND_GAP_MS);
const bank = () => screen.getByRole("meter", { name: "Time bank" });
const steps = () => [...document.querySelectorAll("[data-step]")].map((step) => step.getAttribute("data-step"));

beforeEach(() => {
  round = null;
  mounts = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TimeBankGame", () => {
  it("runs a 3-2-1 under the target before every round, then the round without its own countdown", () => {
    render(<TimeBankGame params={params} onFinish={vi.fn()} />);
    expect(screen.getByText("Tap when you think 15 seconds have passed")).toBeTruthy();
    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(round).toBeNull();
    countdown();
    expect(round).toMatchObject({ params: params.rounds[0], countdownMs: 0 });
    tap(15_200);
    gap();
    // Round 2 waits for its own 3-2-1.
    expect(screen.getByText("Tap when you think 18 seconds have passed")).toBeTruthy();
    expect(screen.queryByText("Round on screen")).toBeNull();
    countdown();
    // Its own timeout, so the hidden-tab rule (T110) ends this round at its own limit.
    expect(round).toMatchObject({ params: params.rounds[1], countdownMs: 0 });
    expect(mounts).toBe(2);
  });

  it("shows each round's error for the gap and drains the bank by it, with a caption and a step", () => {
    render(<TimeBankGame params={params} onFinish={vi.fn()} />);
    expect(bank().getAttribute("aria-valuenow")).toBe("10000");
    expect(steps()).toEqual(["current", "later", "later", "later"]);
    countdown();
    tap(16_200);
    expect(screen.getByText("1.2 s late")).toBeTruthy();
    expect(screen.getByText("-1.2 s")).toBeTruthy();
    expect(bank().getAttribute("aria-valuetext")).toBe("8.8 s left of 10.0 s");
    expect(steps()).toEqual(["done", "current", "later", "later"]);
    wait(ROUND_GAP_MS - 1);
    expect(screen.getByText("1.2 s late")).toBeTruthy();
    wait(1);
    expect(screen.queryByText("1.2 s late")).toBeNull();
    expect(screen.getByText("Round 2")).toBeTruthy();
  });

  it.each([
    [15_000, "Spot on"],
    [14_650, "0.35 s early"],
    [null, "Time ran out"],
    [25_001, "Time ran out"],
  ])("says a tap at %s as %s", (tapMs, label) => {
    render(<TimeBankGame params={params} onFinish={vi.fn()} />);
    countdown();
    tap(tapMs);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("ends the run in the round that busts the bank, marking that step failed", () => {
    const onFinish = vi.fn();
    render(<TimeBankGame params={params} onFinish={onFinish} />);
    countdown();
    tap(19_000);
    gap();
    countdown();
    tap(21_000);
    gap();
    countdown();
    expect(onFinish).not.toHaveBeenCalled();
    // Errors 4,000 and 3,000 leave 3,000; 3,500 busts it.
    tap(24_500);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ tapsMs: [19_000, 21_000, 24_500] });
    expect(bank().getAttribute("aria-valuetext")).toBe("Bank used up");
    expect(steps()).toEqual(["done", "done", "failed", "later"]);
    gap();
    countdown();
    expect(screen.queryByText("Round on screen")).toBeNull();
    expect(mounts).toBe(3);
  });

  it("reports the taps after the fourth round when the bank lasts", () => {
    const onFinish = vi.fn();
    render(<TimeBankGame params={params} onFinish={onFinish} />);
    for (const tapMs of [15_100, 18_100, 21_100]) {
      countdown();
      tap(tapMs);
      gap();
    }
    countdown();
    expect(onFinish).not.toHaveBeenCalled();
    tap(24_100);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ tapsMs: [15_100, 18_100, 21_100, 24_100] });
  });

  it("skips the 3-2-1 with a countdown of 0 (tests of the run)", () => {
    render(<TimeBankGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(round?.params).toEqual(params.rounds[0]);
  });
});
