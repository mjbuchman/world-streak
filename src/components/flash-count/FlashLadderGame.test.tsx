// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { layoutFor, REVEAL_MS, type FlashLadderParams } from "@/challenges/flash-count/flashLadder";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import type { FlashCountGame } from "./FlashCountGame";
import { FlashLadderGame } from "./FlashLadderGame";

// The flash itself (the countdown, the dots, the hidden-tab rule and the answer field) is
// FlashCountGame's, tested on its own; here a stand-in records what each showing is given.
type ShowingProps = ComponentProps<typeof FlashCountGame>;
let showing: ShowingProps | null;
let mounts: number;
vi.mock("./FlashCountGame", async () => {
  const { useEffect } = await import("react");
  return {
    FlashCountGame: (props: ShowingProps) => {
      showing = props;
      useEffect(() => void mounts++, []);
      return <p>Flash on screen</p>;
    },
  };
});

const params: FlashLadderParams = { layoutSeed: 11, levels: [10, 14].map((dotCount) => ({ dotCount, flashMs: 1500 - 100 * dotCount })) };

const answer = (count: number) => act(() => showing!.onFinish({ count }));
const reveal = () => act(() => void vi.advanceTimersByTime(REVEAL_MS));
const now = vi.spyOn(performance, "now");

beforeEach(() => {
  showing = null;
  mounts = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  now.mockReturnValue(1000);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FlashLadderGame", () => {
  it("flashes level 1 after the 3-2-1 with its own layout, then level 2 without it after a right answer", () => {
    render(<FlashLadderGame params={params} onFinish={vi.fn()} />);
    expect(screen.getByText("Level 1 of 2")).toBeTruthy();
    expect(showing).toMatchObject({ countdownMs: RUN_COUNTDOWN_MS, params: { dotCount: 10, flashMs: 500, dots: layoutFor(params, 0, 0) } });
    answer(11);
    expect(screen.getByText("Right")).toBeTruthy();
    expect(screen.queryByText("Flash on screen")).toBeNull();
    act(() => void vi.advanceTimersByTime(REVEAL_MS - 1));
    expect(screen.queryByText("Flash on screen")).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByText("Level 2 of 2")).toBeTruthy();
    expect(showing).toMatchObject({ countdownMs: 0, params: { dotCount: 14, flashMs: 100, dots: layoutFor(params, 1, 0) } });
  });

  it("costs a life for a wrong answer and retries the same level with a new layout", () => {
    render(<FlashLadderGame params={params} onFinish={vi.fn()} />);
    const lives = () => screen.getByRole("img", { name: /lives left$/ }).getAttribute("aria-label");
    expect(lives()).toBe("3 of 3 lives left");
    answer(10);
    reveal();
    answer(17);
    expect(screen.getByText("Off by 3")).toBeTruthy();
    expect(lives()).toBe("2 of 3 lives left");
    reveal();
    expect(screen.getByText("Level 2 of 2")).toBeTruthy();
    expect(showing?.params.dots).toEqual(layoutFor(params, 1, 1));
    expect(showing?.params.dots).not.toEqual(layoutFor(params, 1, 0));
    // A fresh flash for every showing, so the hidden-tab rule (T110) covers each one.
    expect(mounts).toBe(3);
  });

  it("times each answer from its start and reports them once the last level is cleared", () => {
    const onFinish = vi.fn();
    render(<FlashLadderGame params={params} onFinish={onFinish} />);
    now.mockReturnValue(5200);
    answer(10);
    reveal();
    now.mockReturnValue(9000);
    answer(13);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      answers: [
        { count: 10, atMs: 4200 },
        { count: 13, atMs: 8000 },
      ],
    });
    // The last answer's reveal stays; no further flash starts.
    expect(screen.getByText("Right")).toBeTruthy();
    reveal();
    expect(screen.queryByText("Flash on screen")).toBeNull();
  });

  it("reports the answers once the lives run out", () => {
    const onFinish = vi.fn();
    render(<FlashLadderGame params={params} onFinish={onFinish} />);
    for (const count of [1, 2]) {
      now.mockReturnValue(1000 + 1000 * count);
      answer(count);
      reveal();
    }
    expect(onFinish).not.toHaveBeenCalled();
    now.mockReturnValue(4000);
    answer(3);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ answers: [1, 2, 3].map((count) => ({ count, atMs: 1000 * count })) });
    expect(screen.getByRole("img", { name: "0 of 3 lives left" })).toBeTruthy();
    expect(screen.getByText("Off by 7")).toBeTruthy();
  });

  it("passes a custom countdown to level 1 (0 skips it in tests of the run)", () => {
    render(<FlashLadderGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(showing?.countdownMs).toBe(0);
  });
});
