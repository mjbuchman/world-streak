// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { progressAt, useRevealRounds } from "./useRevealRounds";

const REVEAL_MS = 1000;

/** A run of plain numbers that ends after `rounds` of them. */
function setup(rounds: number, onFinish = vi.fn()) {
  const hook = renderHook(
    ({ finish }) =>
      useRevealRounds<number, { values: number[] }>({
        toInputs: (values) => ({ values }),
        isFinished: ({ values }) => values.length >= rounds,
        revealMs: REVEAL_MS,
        onFinish: finish,
      }),
    { initialProps: { finish: onFinish } },
  );
  return { ...hook, onFinish };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRevealRounds (T200)", () => {
  it("starts on the countdown, and moves to the round when told", () => {
    const { result } = setup(2);
    expect(result.current.phase).toBe("countdown");
    act(() => result.current.startRound());
    expect(result.current.phase).toBe("round");
    expect(result.current.entries).toEqual([]);
  });

  it("shows each round's reveal for revealMs, then the next countdown", () => {
    const { result, onFinish } = setup(2);
    act(() => result.current.startRound());
    act(() => result.current.record(7));
    expect(result.current.phase).toBe("reveal");
    expect(result.current.entries).toEqual([7]);
    expect(result.current.inputs).toEqual({ values: [7] });
    act(() => vi.advanceTimersByTime(REVEAL_MS - 1));
    expect(result.current.phase).toBe("reveal");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.phase).toBe("countdown");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("ends the run only after the last reveal, once, with every entry", () => {
    const { result, onFinish } = setup(2);
    act(() => result.current.record(7));
    act(() => vi.advanceTimersByTime(REVEAL_MS));
    act(() => result.current.record(3));
    act(() => vi.advanceTimersByTime(REVEAL_MS - 1));
    expect(onFinish).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ values: [7, 3] });
    act(() => vi.advanceTimersByTime(REVEAL_MS * 3));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("calls the latest callback, and a re-render does not restart the reveal", () => {
    const { result, rerender, onFinish } = setup(1);
    act(() => result.current.record(5));
    act(() => vi.advanceTimersByTime(REVEAL_MS / 2));
    const later = vi.fn();
    rerender({ finish: later });
    act(() => vi.advanceTimersByTime(REVEAL_MS / 2));
    expect(onFinish).not.toHaveBeenCalled();
    expect(later).toHaveBeenCalledWith({ values: [5] });
  });
});

describe("progressAt (T200)", () => {
  it("points at the round being played, and stays on the last round once all are played", () => {
    expect(progressAt(0, 4, { survived: 0, failed: false })).toEqual({ total: 4, current: 0, failedRound: undefined });
    expect(progressAt(2, 4, { survived: 2, failed: false })).toEqual({ total: 4, current: 2, failedRound: undefined });
    expect(progressAt(4, 4, { survived: 4, failed: false })).toEqual({ total: 4, current: 3, failedRound: undefined });
  });

  it("stays on the round that failed", () => {
    expect(progressAt(3, 5, { survived: 2, failed: true })).toEqual({ total: 5, current: 2, failedRound: 2 });
  });
});
