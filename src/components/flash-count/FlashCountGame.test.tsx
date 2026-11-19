// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { layoutFor, REVEAL_MS, type FlashCountParams } from "@/challenges/flash-count/engine";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import type { FlashCountShowing } from "./FlashCountShowing";
import { FlashCountGame } from "./FlashCountGame";

// The flash itself (the dots, the hidden-tab rule and the answer field) is FlashCountShowing's,
// tested on its own; here a stand-in records what each round is given.
type ShowingProps = ComponentProps<typeof FlashCountShowing>;
let showing: ShowingProps | null;
let mounts: number;
vi.mock("./FlashCountShowing", async () => {
  const { useEffect } = await import("react");
  return {
    FlashCountShowing: (props: ShowingProps) => {
      showing = props;
      useEffect(() => void mounts++, []);
      return <p>Flash on screen</p>;
    },
  };
});

// Frames from fake timers: performance.now and requestAnimationFrame both follow them.
const params: FlashCountParams = { layoutSeed: 11, bank: 10, levels: [10, 14, 18, 22, 26].map((dotCount, i) => ({ dotCount, flashMs: 1800 - 100 * i })) };

const answer = (count: number) => act(() => showing!.onFinish({ count }));
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
/** The 3-2-1, run out (a few frames past its end). */
const countdown = () => wait(RUN_COUNTDOWN_MS + 100);
const reveal = () => wait(REVEAL_MS);
const bank = () => screen.getByRole("meter", { name: "Dot bank" });
const steps = () => [...document.querySelectorAll("[data-step]")].map((step) => step.getAttribute("data-step"));

beforeEach(() => {
  showing = null;
  mounts = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FlashCountGame", () => {
  it("runs a 3-2-1 before every round, then flashes that round's own layout without one", () => {
    render(<FlashCountGame params={params} onFinish={vi.fn()} />);
    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(showing).toBeNull();
    countdown();
    expect(showing).toMatchObject({ countdownMs: 0, params: { dotCount: 10, flashMs: 1800, dots: layoutFor(params, 0) } });
    answer(10);
    reveal();
    expect(screen.getByText("Round 2")).toBeTruthy();
    expect(screen.queryByText("Flash on screen")).toBeNull();
    countdown();
    expect(showing).toMatchObject({ countdownMs: 0, params: { dotCount: 14, flashMs: 1700, dots: layoutFor(params, 1) } });
    // A fresh flash for every round, so the hidden-tab rule (T110) covers each one.
    expect(mounts).toBe(2);
  });

  it("shows each answer's miss for the reveal and drains the bank by it, with a step per round", () => {
    render(<FlashCountGame params={params} onFinish={vi.fn()} />);
    expect(bank().getAttribute("aria-valuetext")).toBe("10 dots left of 10 dots");
    expect(steps()).toEqual(["current", "later", "later", "later", "later"]);
    countdown();
    answer(10);
    wait(REVEAL_MS - 1);
    expect(screen.getByRole("status").textContent).toBe("Right on");
    wait(1);
    expect(screen.getByText("Round 2")).toBeTruthy();
    countdown();
    answer(11);
    expect(screen.getByRole("status").textContent).toBe("Off by 3");
    expect(screen.getByText("-3 dots")).toBeTruthy();
    expect(bank().getAttribute("aria-valuetext")).toBe("7 dots left of 10 dots");
    expect(steps()).toEqual(["done", "done", "current", "later", "later"]);
  });

  it("says a miss of one dot in the singular", () => {
    render(<FlashCountGame params={params} onFinish={vi.fn()} />);
    countdown();
    answer(9);
    expect(screen.getByText("-1 dot")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Off by 1");
  });

  it("ends the run in the round that busts the bank, after its reveal, with the answers timed from the start", () => {
    const onFinish = vi.fn();
    render(<FlashCountGame params={params} onFinish={onFinish} />);
    countdown();
    wait(900);
    answer(16);
    reveal();
    countdown();
    answer(14);
    reveal();
    countdown();
    // Off by 6, right on, then off by 5 with 4 left: the bank is bust in round 3.
    answer(13);
    expect(bank().getAttribute("aria-valuetext")).toBe("Bank used up");
    expect(steps()).toEqual(["done", "done", "failed", "later", "later"]);
    // The last miss shows for the reveal first, so a phone's click after the answer cannot reach the result.
    wait(REVEAL_MS - 1);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Off by 5");
    wait(1);
    const first = RUN_COUNTDOWN_MS + 100 + 900;
    const round = REVEAL_MS + RUN_COUNTDOWN_MS + 100;
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      answers: [
        { count: 16, atMs: first },
        { count: 14, atMs: first + round },
        { count: 13, atMs: first + 2 * round },
      ],
    });
    countdown();
    expect(screen.queryByText("Flash on screen")).toBeNull();
    expect(mounts).toBe(3);
  });

  it("reports the answers after all five rounds when small misses leave the bank", () => {
    const onFinish = vi.fn();
    render(<FlashCountGame params={params} onFinish={onFinish} />);
    for (const count of [9, 15, 17, 23]) {
      countdown();
      answer(count);
      reveal();
    }
    countdown();
    answer(25);
    expect(bank().getAttribute("aria-valuetext")).toBe("5 dots left of 10 dots");
    // As in Second Sense, the last step stays current until the result replaces the run.
    expect(steps()).toEqual(["done", "done", "done", "done", "current"]);
    expect(onFinish).not.toHaveBeenCalled();
    reveal();
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish.mock.calls[0][0].answers.map((a: { count: number }) => a.count)).toEqual([9, 15, 17, 23, 25]);
    expect(mounts).toBe(5);
  });

  it("plays five rounds whose counts jump up and down, each showing its own count and miss (T206)", () => {
    const jumps = { ...params, levels: [28, 11, 24, 15, 30].map((dotCount) => ({ dotCount, flashMs: 1500 })) };
    render(<FlashCountGame params={jumps} onFinish={vi.fn()} />);
    const rounds: [number, number, string][] = [
      [28, 27, "Off by 1"],
      [11, 11, "Right on"],
      [24, 26, "Off by 2"],
      [15, 15, "Right on"],
      [30, 29, "Off by 1"],
    ];
    for (const [dotCount, count, said] of rounds) {
      countdown();
      expect(showing?.params.dotCount).toBe(dotCount);
      answer(count);
      expect(screen.getByRole("status").textContent).toBe(said);
      reveal();
    }
  });

  it("skips the 3-2-1 with a countdown of 0 (tests of the run)", () => {
    render(<FlashCountGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(showing?.params.dotCount).toBe(10);
  });
});
